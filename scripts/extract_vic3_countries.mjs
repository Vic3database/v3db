import fs from "node:fs";
import path from "node:path";
import extractorEn from "./locales/extractor.en.mjs";
import extractorZhHans from "./locales/extractor.zh-Hans.mjs";
import economyLocalizationAliases from "./locales/victorian-century-aliases.mjs";
import { sha256Text, splitLocalizedTrees } from "./lib/localization-schema.mjs";
import { withBaseGameLocalization } from "./lib/localization-overrides.mjs";
import {
  applyDefinitionAssignment,
  parseDefinitionDirective,
} from "./lib/clausewitz-definition-patches.mjs";

const DEFAULT_GAME_PATH = "D:\\SteamLibrary\\steamapps\\common\\Victoria 3";
const DEFAULT_VERSION = "1.13.9";

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const gamePath = path.resolve(args["game-path"] || DEFAULT_GAME_PATH);
const modPath = args["mod-path"] ? path.resolve(args["mod-path"]) : "";
const version = args.version || DEFAULT_VERSION;
const outDir = path.resolve(args.out || "output");
const databaseDir = path.resolve(args.database || path.join("database", `vic3_${version}`));
const gameDir = resolveContentRoot(gamePath);
const modContentRoot = modPath ? resolveContentRoot(modPath) : "";
const contentRoots = [gameDir, modContentRoot].filter(Boolean);
const datasetName = args["dataset-name"] || readDatasetName(modPath) || "Victoria 3";

const tierZh = {
  city_state: "城邦",
  principality: "公国",
  grand_principality: "大公国",
  kingdom: "王国",
  empire: "帝国",
  hegemony: "霸权",
};

const tierPrestige = {
  city_state: 0,
  principality: 5,
  grand_principality: 10,
  kingdom: 15,
  empire: 25,
  hegemony: 50,
};

const countryTypeZh = {
  recognized: "受认可",
  colonial: "殖民地",
  unrecognized: "未受认可国家",
  decentralized: "松散部族",
  company: "公司",
};

const companyDlcByFeature = new Map([
  ["rp1_content", { key: "dlc008", name_zh: "Colossus of the South", name_en: "Colossus of the South", icon: "dlc008.png" }],
  ["ep1_content", { key: "dlc010", name_zh: "Sphere of Influence", name_en: "Sphere of Influence", icon: "dlc010.png" }],
  ["ip2_content", { key: "dlc011", name_zh: "Pivot of Empire", name_en: "Pivot of Empire", icon: "dlc011.png" }],
  ["mp1_content", { key: "dlc013", name_zh: "Charters of Commerce", name_en: "Charters of Commerce", icon: "dlc013.png" }],
  ["ip3_content", { key: "dlc014", name_zh: "National Awakening", name_en: "National Awakening", icon: "dlc014.png" }],
  ["ip4_content", { key: "dlc016", name_zh: "Iberian Twilight", name_en: "Iberian Twilight", icon: "dlc016.png" }],
  ["ep2_content", { key: "dlc018", name_zh: "The Great Wave", name_en: "The Great Wave", icon: "dlc018.png" }],
]);

const baseGameDlcRef = {
  key: "base",
  name_zh: "本体",
  name_en: "Victoria 3",
  icon: "v3.png",
};

const specialCountryMechanics = new Map([
  ["CSA", "美国内战"],
  ["FSA", "美国内战"],
  ["PRC", "巴黎公社"],
  ["TPG", "太平天国"],
]);

const knownFlavorDefinitionHints = new Map([
  ["ideology_austrian_hegemony", {
    status: "unassigned",
    note_zh: "旧版本奥地利地主风味意识形态定义；当前 1.13.9 脚本未分配给任何利益集团。",
  }],
]);

const strategicRegionOrder = [
  "region_western_europe",
  "region_southern_europe",
  "region_central_europe",
  "region_northern_europe",
  "region_balkans",
  "region_eastern_europe",
  "region_russia",
  "region_central_asia",
  "region_greater_persia",
  "region_near_east",
  "region_arabia",
  "region_india",
  "region_north_india",
  "region_south_india",
  "region_himalayas",
  "region_indochina",
  "region_indonesia",
  "region_south_china",
  "region_north_china",
  "region_northeast_asia",
  "region_siberia",
  "region_canada",
  "region_atlantic_coast",
  "region_great_plains",
  "region_pacific_coast",
  "region_mexico",
  "region_central_america",
  "region_caribbean",
  "region_gran_colombia",
  "region_andes",
  "region_la_plata",
  "region_brazil",
  "region_oceania",
  "region_north_africa",
  "region_nile_basin",
  "region_west_africa",
  "region_niger",
  "region_equatorial_africa",
  "region_east_africa",
  "region_southern_africa",
];

const strategicRegionOrderByKey = new Map(strategicRegionOrder.map((key, index) => [key, index]));

function main() {
  if (!fs.existsSync(path.join(gameDir, "common"))) {
    throw new Error(`找不到游戏数据目录: ${gameDir}`);
  }
  if (modPath && !fs.existsSync(modContentRoot)) {
    throw new Error(`找不到模组目录: ${modPath}`);
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(databaseDir, { recursive: true });

  const loc = loadLocalization(contentPath("localization", "simp_chinese"));
  const locEn = loadLocalization(contentPath("localization", "english"));
  applyLocalizationAliases(loc, economyLocalizationAliases.common["zh-Hans"], "zh-Hans");
  applyLocalizationAliases(locEn, economyLocalizationAliases.common.en, "en");
  if (modContentRoot) {
    applyLocalizationAliases(
      loc,
      economyLocalizationAliases.victorianCentury["zh-Hans"],
      "zh-Hans",
    );
    applyLocalizationAliases(
      locEn,
      economyLocalizationAliases.victorianCentury.en,
      "en",
    );
  }
  const economyLoc = modContentRoot
    ? withBaseGameLocalization(
      loc,
      loadLocalization(path.join(gameDir, "localization", "simp_chinese")),
      economyLocalizationAliases.victorianCenturyBaseGame["zh-Hans"],
      "zh-Hans",
    )
    : loc;
  const cultures = loadCultures(contentPath("common", "cultures"));
  applyStartingCultureObsessions(cultures, loadStartingCultureObsessions({
    historyDirs: contentPath("common", "history", "countries"),
    journalEntryDirs: contentPath("common", "journal_entries"),
    scriptedEffectDirs: contentPath("common", "scripted_effects"),
    cultures,
    loc,
  }));
  const cultureTraits = loadCultureTraits(contentPath("common", "discrimination_traits"), loc);
  const cultureTraitGroups = loadCultureTraitGroups(contentPath("common", "discrimination_trait_groups"), loc);
  const religions = loadReligions(contentPath("common", "religions"), loc);
  const popNeeds = loadPopNeeds(contentPath("common", "pop_needs"), loc);
  const buyPackages = loadBuyPackages(contentPath("common", "buy_packages"));
  const definitions = loadCountryDefinitions(contentPath("common", "country_definitions"));
  const stateHistory = loadStateHistory(contentPath("common", "history", "states", "00_states.txt"));
  const startingOwners = stateHistory.startingOwnersByCountry;
  const startingSubjectsByTag = loadStartingSubjectRelationships(
    contentPath("common", "history", "diplomacy", "00_subject_relationships.txt"),
  );
  const startingDiplomacy = loadStartingDiplomacy(
    contentPath("common", "history", "diplomacy"),
  );
  const strategicRegions = loadStrategicRegions(contentPath("common", "strategic_regions"), loc);
  const geographicRegions = loadGeographicRegions(contentPath("common", "geographic_regions"), strategicRegions, loc);
  const stateTraits = loadStateTraits(contentPath("common", "state_traits"), loc);
  const stateRegionDefinitions = loadStateRegionDefinitions(contentPath("map_data", "state_regions"), loc, stateTraits);
  const dynamicStateNameVariantsByState = loadDynamicStateNameVariants(
    contentPath("common", "scripted_effects"),
    stateRegionDefinitions,
    loc,
  );
  const stateRegionRows = buildStateRegionRows(
    stateRegionDefinitions,
    strategicRegions,
    stateHistory,
    dynamicStateNameVariantsByState,
    loc,
  );
  const strategicRegionRows = buildStrategicRegionRows(strategicRegions, stateRegionRows, loc);
  const companies = loadCompanies(contentPath("common", "company_types"), loc, stateRegionRows, strategicRegionRows);
  const companyCharterTypes = loadCompanyCharterTypes(contentPath("common", "company_charter_types"), loc);
  const interestGroupTraits = loadInterestGroupTraits(contentPath("common", "interest_group_traits"), loc);
  const ideologies = loadIdeologies(contentPath("common", "ideologies"), loc);
  const lawGroups = loadLawGroups(contentPath("common", "law_groups"), loc);
  const institutions = loadInstitutions(contentPath("common", "institutions"), loc);
  const amendments = loadLawAmendments(contentPath("common", "amendments"), loc);
  const laws = loadLaws(contentPath("common", "laws"), lawGroups, institutions, loc);
  attachLawAmendments(laws, amendments);
  const technologyEras = loadTechnologyEras(contentPath("common", "technology", "eras"));
  const technologies = loadTechnologies(
    contentPath("common", "technology", "technologies"),
    technologyEras,
    loc,
  );
  const startingTechnologyTemplates = loadStartingTechnologyTemplates(
    contentPath("common", "scripted_effects"),
    technologies,
  );
  const startingCountryData = loadStartingCountryData(
    contentPath("common", "history", "countries"),
    technologies,
    laws,
    amendments,
    lawGroups,
    contentPath("common", "scripted_effects"),
    definitions,
    cultures,
    startingTechnologyTemplates,
    loc,
  );
  const economy = loadEconomyData({
    buildingDirs: contentPath("common", "buildings"),
    buildingGroupDirs: contentPath("common", "building_groups"),
    productionMethodGroupDirs: contentPath("common", "production_method_groups"),
    productionMethodDirs: contentPath("common", "production_methods"),
    goodsDirs: contentPath("common", "goods"),
    prestigeGoodsDirs: contentPath("common", "prestige_goods"),
    stateRegionRows,
    cultures,
    religions,
    companies,
    popNeeds,
    buyPackages,
    loc: economyLoc,
  });
  const achievements = loadAchievements(
    contentPath("common", "achievements"),
    contentPath("common", "achievement_groups.txt"),
    contentPath("gfx", "interface", "icons", "achievements"),
    loc,
    locEn,
  );
  attachTechnologyReferences(technologies, { laws, companies });
  const interestGroups = loadInterestGroups(
    contentPath("common", "interest_groups"),
    loc,
    interestGroupTraits,
    ideologies,
  );
  attachInterestGroupPotentialFlavors(interestGroups, {
    sourceDirs: interestGroupFlavorSourceDirs(),
    loc,
    interestGroupTraits,
  });
  attachInterestGroupConditionVariants(interestGroups, {
    loc,
    interestGroupTraits,
    ideologies,
  });
  applyIdeologyUnlockSources(ideologies, collectIdeologyUnlockSources({
    interestGroupDir: contentPath("common", "interest_groups"),
    politicalMovementDir: contentPath("common", "political_movements"),
    eventDirs: [
      contentPath("events"),
      contentPath("events", "law_events"),
    ],
    loc,
  }));
  applyIdeologyDefinitionUsage(ideologies, interestGroups, loc);
  const historyCountryTags = loadHistoryCountryTags(contentPath("common", "history", "countries"));
  const historyReligionOverrides = loadHistoryReligionOverrides(contentPath("common", "history", "countries"));
  const releasables = loadCountryRules(contentPath("common", "country_creation"), "release");
  const formables = loadCountryRules(contentPath("common", "country_formation"), "formation");
  const dynamicNameVariants = loadDynamicCountryNames(contentPath("common", "dynamic_country_names"), loc);
  const dynamicNameVariantsByScope = groupBy(dynamicNameVariants, "scope");
  const namedColors = loadNamedColors(contentPath("common", "named_colors"));
  const dynamicMapColorRules = loadDynamicCountryMapColors(contentPath("common", "dynamic_country_map_colors"), namedColors);
  const dynamicMapColorRulesByTag = groupMapColorRulesByTag(dynamicMapColorRules);
  addFormationCandidateCultures(formables, definitions);
  const canFormByCulture = buildCanFormByCulture(definitions, formables);
  const relatedCountriesByCulture = buildRelatedCountriesByCulture(definitions, loc);

  const allTags = new Set([
    ...definitions.keys(),
    ...startingOwners.keys(),
    ...startingSubjectsByTag.keys(),
    ...[...startingSubjectsByTag.values()].map((subject) => subject.overlord_tag),
    ...historyCountryTags,
    ...releasables.keys(),
    ...formables.keys(),
  ]);

  const dynamicTags = [...definitions.values()]
    .filter((def) => def.dynamic)
    .map((def) => def.tag)
    .sort();
  for (const tag of dynamicTags) allTags.delete(tag);

  const countryRows = [...allTags]
    .sort()
    .map((tag) => buildCountryRow({
      tag,
      def: definitions.get(tag),
      loc,
      cultures,
      religions,
      startingOwners,
      startingSubjectsByTag,
      startingCountryData,
      startingDiplomacy,
      historyCountryTags,
      historyReligionOverrides,
      releasables,
      formables,
      canFormByCulture,
      dynamicNameVariantsByScope,
      dynamicMapColorRulesByTag,
    }));
  attachAchievementCountryReferences(achievements, countryRows);
  const existingAtStartTags = new Set(countryRows
    .filter((row) => row.exists_at_start === "是")
    .map((row) => row.tag));
  const cultureRows = buildCultureRows(cultures, cultureTraits, cultureTraitGroups, relatedCountriesByCulture, stateRegionRows, loc, economyLoc);
  const cultureTraitRows = [...cultureTraits.values()].sort((a, b) => a.key.localeCompare(b.key));
  const cultureTraitGroupRows = [...cultureTraitGroups.values()].sort((a, b) => a.key.localeCompare(b.key));

  const releaseRows = [...releasables.values()]
    .filter((rule) => !dynamicTags.includes(rule.tag))
    .sort((a, b) => a.tag.localeCompare(b.tag))
    .map((rule) => buildRuleRow(rule, loc, cultures));

  const formationRows = [...formables.values()]
    .filter((rule) => !dynamicTags.includes(rule.tag))
    .sort((a, b) => a.tag.localeCompare(b.tag))
    .map((rule) => buildRuleRow(rule, loc, cultures));

  const prefix = `vic3_${version}`;
  writeCsv(path.join(outDir, `${prefix}_countries.csv`), countryRows, [
    "tag",
    "name_zh",
    "exists_at_start",
    "starting_state_count",
    "starting_states",
    "starting_overlord_tag",
    "starting_subject_type",
    "starting_subject_uses_overlord_color",
    "starting_technology_tier",
    "starting_technology_template",
    "starting_technology_eras",
    "starting_technology_template_keys",
    "starting_technology_keys",
    "starting_law_keys",
    "has_history_country_file",
    "is_releasable",
    "is_formable",
    "is_major_formable",
    "can_form_tags_by_primary_culture",
    "can_form_names_zh_by_primary_culture",
    "primary_cultures",
    "primary_cultures_zh",
    "religion",
    "religion_zh",
    "religion_source",
    "tier",
    "tier_zh",
    "tier_prestige",
    "color_rgb",
    "color_hex",
    "primary_unit_color",
    "secondary_unit_color",
    "tertiary_unit_color",
    "country_type",
    "country_type_zh",
    "capital",
    "capital_zh",
    "dynamic_name_variant_count",
    "dynamic_map_color_rule_count",
    "formation_required_cultures",
    "formation_required_cultures_zh",
    "formation_states",
    "formation_region",
    "release_states",
    "definition_file",
  ]);

  writeCsv(path.join(outDir, `${prefix}_formable_countries.csv`), formationRows, [
    "tag",
    "name_zh",
    "is_major_formable",
    "use_culture_states",
    "required_states_fraction",
    "required_num_states",
    "states",
    "states_zh",
    "geographic_region",
    "geographic_region_zh",
    "candidate_cultures",
    "candidate_cultures_zh",
    "required_cultures",
    "required_cultures_zh",
    "referenced_tags",
    "source_file",
  ]);

  writeCsv(path.join(outDir, `${prefix}_releasable_countries.csv`), releaseRows, [
    "tag",
    "name_zh",
    "is_major_formable",
    "use_culture_states",
    "required_states_fraction",
    "required_num_states",
    "states",
    "states_zh",
    "geographic_region",
    "geographic_region_zh",
    "required_cultures",
    "required_cultures_zh",
    "referenced_tags",
    "source_file",
  ]);

  writeJson(path.join(outDir, `${prefix}_countries.json`), {
    meta: {
      victoria3_version: version,
      game_path: gamePath,
      generated_at: new Date().toISOString(),
      excluded_dynamic_tags: dynamicTags,
    },
    countries: countryRows,
    cultures: cultureRows,
    culture_traits: cultureTraitRows,
    culture_trait_groups: cultureTraitGroupRows,
    state_regions: stateRegionRows,
    strategic_regions: strategicRegionRows,
    companies,
    company_charter_types: companyCharterTypes,
    interest_groups: interestGroups.map(publicInterestGroup),
    interest_group_traits: [...interestGroupTraits.values()],
    ideologies: ideologyCoverageRows(ideologies, countryRows, interestGroups, {
      cultures,
      cultureTraits,
      interestGroupTraits,
      ideologies,
      existingAtStartTags,
      locName: (key) => locCleanName(loc, key),
    }),
    law_groups: [...lawGroups.values()],
    laws: [...laws.values()],
    formable_countries: formationRows,
    releasable_countries: releaseRows,
    dynamic_country_name_variants: dynamicNameVariants,
    dynamic_country_map_color_rules: dynamicMapColorRules,
  });

  writeDatabase(databaseDir, {
    version,
    datasetName,
    gamePath,
    gameDir,
    modPath,
    modContentRoot,
    loc,
    countryRows,
    cultures,
    cultureTraits,
    cultureTraitGroups,
    stateRegionRows,
    strategicRegionRows,
    companies,
    companyCharterTypes,
    interestGroups,
    religions,
    interestGroupTraits,
    ideologies,
    lawGroups,
    laws,
    technologies,
    technologyEras,
    achievements,
    geographicRegions,
    relatedCountriesByCulture,
    definitions,
    dynamicNameVariants,
    dynamicMapColorRules,
    cultureRows,
    cultureTraitRows,
    cultureTraitGroupRows,
    formableRules: formables,
    formables: formationRows,
    releasables: releaseRows,
    economy,
    popNeeds,
    buyPackages,
    localeCatalogs: {
      "zh-Hans": { ...Object.fromEntries(loc), ...extractorZhHans },
      en: { ...Object.fromEntries(locEn), ...extractorEn },
    },
  });

  writeNotes(path.join(outDir, `${prefix}_说明.md`), {
    version,
    datasetName,
    gamePath,
    modPath,
    databaseDir,
    countryRows,
    releaseRows,
    formationRows,
    dynamicTags,
    dynamicNameVariants,
    dynamicMapColorRules,
    cultures: cultureRows,
    cultureTraits: cultureTraitRows,
    cultureTraitGroups: cultureTraitGroupRows,
    stateRegions: stateRegionRows,
    strategicRegions: strategicRegionRows,
    companies,
    companyCharterTypes,
    interestGroups,
    interestGroupTraits,
    ideologies,
    lawGroups,
    laws,
    definitions,
    startingOwners,
    historyCountryTags,
  });

  console.log(JSON.stringify({
    version,
    countries: countryRows.length,
    definitions: definitions.size,
    excluded_dynamic_tags: dynamicTags.length,
    starts_with_land: countryRows.filter((row) => row.exists_at_start === "是").length,
    releasable: releaseRows.length,
    formable: formationRows.length,
    cultures: cultures.size,
    culture_traits: cultureTraits.size,
    culture_trait_groups: cultureTraitGroups.size,
    state_regions: stateRegionRows.length,
    strategic_regions: strategicRegionRows.length,
    companies: companies.length,
    company_charter_types: companyCharterTypes.length,
    interest_groups: interestGroups.length,
    interest_group_traits: interestGroupTraits.size,
    ideologies: ideologies.size,
    law_groups: lawGroups.size,
    laws: laws.size,
    technologies: technologies.length,
    achievements: achievements.length,
    output: outDir,
    database: databaseDir,
    dataset_name: datasetName,
    mod_path: modPath,
  }, null, 2));
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
  console.log(`Usage: node scripts/extract_vic3_countries.mjs [options]

Options:
  --game-path <path>     Victoria 3 install path, default ${DEFAULT_GAME_PATH}
  --mod-path <path>      Optional mod or workshop content path
  --dataset-name <name>  Dataset name, default Victoria 3 or mod metadata name
  --version <version>    Version label, default ${DEFAULT_VERSION}
  --out <path>           Output directory for CSV/JSON notes, default output
  --database <path>      Database directory, default database/vic3_<version>
  --help                 Show this help
`);
}

function resolveContentRoot(sourcePath) {
  const resolved = path.resolve(sourcePath);
  if (fs.existsSync(path.join(resolved, "game", "common"))) return path.join(resolved, "game");
  return resolved;
}

function contentPath(...segments) {
  return contentRoots.map((root) => path.join(root, ...segments));
}

function readDatasetName(sourcePath) {
  if (!sourcePath) return "";
  const metadataFile = path.join(sourcePath, ".metadata", "metadata.json");
  if (fs.existsSync(metadataFile)) {
    try {
      const metadata = JSON.parse(readText(metadataFile));
      if (metadata?.name) return String(metadata.name);
    } catch {
      return "";
    }
  }
  return "";
}

function listFiles(targets, suffix = ".txt") {
  const list = Array.isArray(targets) ? targets : [targets];
  return list.flatMap((target) => listFilesFromPath(target, suffix));
}

function listEffectiveFiles(targets, suffix = ".txt") {
  const files = new Map();
  for (const target of Array.isArray(targets) ? targets : [targets]) {
    if (!target || !fs.existsSync(target)) continue;
    const base = fs.statSync(target).isDirectory() ? target : path.dirname(target);
    for (const file of listFilesFromPath(target, suffix)) {
      files.set(normalizePath(path.relative(base, file)), file);
    }
  }
  return [...files.values()].sort();
}

function listFilesFromPath(target, suffix = ".txt") {
  if (!target || !fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return path.basename(target).endsWith(suffix) ? [target] : [];
  const out = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) out.push(...listFilesFromPath(full, suffix));
    if (entry.isFile() && entry.name.endsWith(suffix)) out.push(full);
  }
  return out.sort();
}

function applyLocalizationAliases(catalog, aliases, locale) {
  for (const [objectKey, targetKey] of Object.entries(aliases || {})) {
    if (!catalog.has(targetKey)) {
      throw new Error(`localization alias target is missing: ${locale} ${objectKey} -> ${targetKey}`);
    }
    catalog.set(objectKey, catalog.get(targetKey));
  }
}

function loadPatchedDefinitions(dirs, accept) {
  const definitions = new Map();
  for (const file of listFiles(dirs)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const { key } = parseDefinitionDirective(assignment.key);
      const node = asNode(assignment.value);
      if (!accept(key, node)) continue;
      const relativeToMod = modContentRoot ? path.relative(modContentRoot, file) : "";
      const modStage = Boolean(modContentRoot)
        && !relativeToMod.startsWith("..")
        && !path.isAbsolute(relativeToMod);
      applyDefinitionAssignment(
        definitions,
        assignment,
        normalizePath(file),
        { modStage },
      );
    }
  }
  return definitions;
}

function readText(file) {
  return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
}

function loadLocalization(dir) {
  const loc = new Map();
  const files = listFiles(dir, ".yml");
  const linePattern = /^\s*([^#\s:]+):(?:\d+)?\s*"(.*)"\s*(?:#.*)?$/;
  for (const file of files) {
    const text = readText(file);
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(linePattern);
      if (!match) continue;
      const key = match[1];
      let value = match[2];
      value = value.replace(/\\"/g, "\"");
      loc.set(key, value);
    }
  }
  return loc;
}

function loadCultures(dir) {
  const cultures = new Map();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!isPlainTagLike(key)) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      const heritage = stripPrefix(firstScalar(node, "heritage"));
      const language = stripPrefix(firstScalar(node, "language"));
      const traditionsNode = asNode(firstValue(node, "traditions"));
      const obsessionsNode = asNode(firstValue(node, "obsessions"));
      const taboosNode = asNode(firstValue(node, "taboos"));
      const color = parseColorValue(firstValue(node, "color"));
      const obsessions = obsessionsNode ? nodeItems(obsessionsNode).map(stripPrefix).sort() : [];
      cultures.set(key, {
        key,
        color,
        religion: stripPrefix(firstScalar(node, "religion")),
        heritage,
        language,
        traditions: traditionsNode ? nodeItems(traditionsNode).map(stripPrefix).sort() : [],
        static_obsessions: obsessions,
        starting_obsessions: [],
        obsessions,
        taboos: taboosNode ? nodeItems(taboosNode).map(stripPrefix).sort() : [],
        trait_keys: [heritage, language, ...(traditionsNode ? nodeItems(traditionsNode).map(stripPrefix) : [])].filter(Boolean).sort(),
        file: normalizePath(file),
      });
    }
  }
  return cultures;
}

function loadStartingCultureObsessions({ historyDirs, journalEntryDirs, scriptedEffectDirs, cultures, loc }) {
  const journalSources = collectStartingJournalSources(historyDirs);
  const journalDefinitions = loadPatchedDefinitions(
    journalEntryDirs,
    (key, node) => journalSources.has(key) && Boolean(node),
  );
  const scriptedEffects = loadPatchedDefinitions(scriptedEffectDirs, (_, node) => Boolean(node));
  const byCulture = new Map();

  function addEffect(cultureKey, goodKey, context) {
    if (!cultures.has(cultureKey) || !goodKey) return;
    if (!byCulture.has(cultureKey)) byCulture.set(cultureKey, new Map());
    const effectsByGood = byCulture.get(cultureKey);
    if (!effectsByGood.has(goodKey)) effectsByGood.set(goodKey, {
      good_key: goodKey,
      sources: [],
    });
    const entry = effectsByGood.get(goodKey);
    const source = {
      id: `starting_culture_obsession_source:${context.journal_key}:${cultureKey}:${goodKey}:${context.script_key || "journal"}`,
      journal_key: context.journal_key,
      journal_name_zh: locName(loc, context.journal_key),
      country_tags: context.country_tags,
      journal_file: context.journal_file,
      script_key: context.script_key || "",
      script_file: context.script_file || "",
    };
    if (!entry.sources.some((item) => item.id === source.id)) entry.sources.push(source);
  }

  function collectEffects(value, context, cultureKey = "", scriptStack = []) {
    const node = asNode(value);
    if (!node) return;
    for (const item of node.items) collectEffects(item, context, cultureKey, scriptStack);
    for (const assignment of node.assignments) {
      const key = scriptEntryKey(assignment.key);
      const scopedCulture = key.startsWith("cu:") ? stripPrefix(key) : cultureKey;
      if (key === "add_cultural_obsession" && cultureKey) {
        addEffect(cultureKey, stripPrefix(scalarFromValue(assignment.value)), context);
        continue;
      }
      if (key.startsWith("cu:")) {
        collectEffects(assignment.value, context, scopedCulture, scriptStack);
        continue;
      }
      const scriptedEffect = scriptedEffects.get(key);
      if (scriptedEffect && scalarFromValue(assignment.value) === "yes" && !scriptStack.includes(key)) {
        collectEffects(scriptedEffect.node, {
          ...context,
          script_key: key,
          script_file: scriptedEffect.source_file,
        }, cultureKey, [...scriptStack, key]);
        continue;
      }
      collectEffects(assignment.value, context, cultureKey, scriptStack);
    }
  }

  for (const [journalKey, source] of journalSources) {
    const journal = journalDefinitions.get(journalKey);
    const immediate = journal?.node ? asNode(firstValue(journal.node, "immediate")) : null;
    if (!immediate) continue;
    collectEffects(immediate, {
      journal_key: journalKey,
      country_tags: source.country_tags,
      journal_file: journal.source_file,
      script_key: "",
      script_file: "",
    });
  }

  return new Map([...byCulture].map(([cultureKey, effectsByGood]) => [
    cultureKey,
    [...effectsByGood.values()]
      .map((entry) => ({
        ...entry,
        sources: entry.sources.sort((left, right) => left.id.localeCompare(right.id)),
      }))
      .sort((left, right) => left.good_key.localeCompare(right.good_key)),
  ]));
}

function collectStartingJournalSources(historyDirs) {
  const sources = new Map();
  for (const file of listEffectiveFiles(historyDirs)) {
    const root = parseScript(readText(file), file);
    const countries = asNode(firstValue(root, "COUNTRIES")) || root;
    for (const assignment of countries.assignments) {
      const tag = stripPrefix(scriptEntryKey(assignment.key)).toUpperCase();
      if (!/^[A-Z0-9]{3}$/.test(tag)) continue;
      for (const journalKey of collectAddedJournalEntryRefs(assignment.value)) {
        if (!sources.has(journalKey)) sources.set(journalKey, {
          country_tags: new Set(),
          history_files: new Set(),
        });
        const source = sources.get(journalKey);
        source.country_tags.add(tag);
        source.history_files.add(normalizePath(file));
      }
    }
  }
  return new Map([...sources].map(([journalKey, source]) => [journalKey, {
    country_tags: [...source.country_tags].sort(),
    history_files: [...source.history_files].sort(),
  }]));
}

function collectAddedJournalEntryRefs(value, out = new Set()) {
  const node = asNode(value);
  if (!node) return out;
  for (const item of node.items) collectAddedJournalEntryRefs(item, out);
  for (const assignment of node.assignments) {
    if (assignment.key === "add_journal_entry") {
      const entry = asNode(assignment.value);
      const journalKey = entry ? stripPrefix(firstScalar(entry, "type")) : stripPrefix(scalarFromValue(assignment.value));
      if (journalKey) out.add(journalKey);
    }
    collectAddedJournalEntryRefs(assignment.value, out);
  }
  return out;
}

function applyStartingCultureObsessions(cultures, startingObsessionsByCulture) {
  for (const culture of cultures.values()) {
    culture.starting_obsessions = startingObsessionsByCulture.get(culture.key) || [];
    culture.obsessions = unique([
      ...(culture.static_obsessions || []),
      ...culture.starting_obsessions.map((entry) => entry.good_key),
    ]).sort();
  }
}

function loadCultureTraits(dir, loc) {
  const traits = new Map();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!isPlainTagLike(key)) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      const type = firstScalar(node, "type");
      if (type !== "heritage" && type !== "language" && type !== "tradition") continue;
      const group = firstScalar(node, "trait_group");
      traits.set(key, {
        id: `culture_trait:${key}`,
        key,
        name_zh: locName(loc, key),
        type,
        type_zh: cultureTraitTypeZh(type),
        group_key: group,
        group_name_zh: group ? locName(loc, group) : "",
        source_file: normalizePath(file),
      });
    }
  }
  return traits;
}

function loadCultureTraitGroups(dir, loc) {
  const groups = new Map();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!isPlainTagLike(key)) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      const type = firstScalar(node, "type");
      if (type !== "heritage" && type !== "language" && type !== "tradition") continue;
      groups.set(key, {
        id: `culture_trait_group:${key}`,
        key,
        name_zh: locName(loc, key),
        type,
        type_zh: cultureTraitTypeZh(type),
        source_file: normalizePath(file),
      });
    }
  }
  return groups;
}

function loadReligions(dir, loc) {
  const religions = new Map();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!isPlainTagLike(key)) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      const texture = firstScalar(node, "icon");
      const color = parseColorValue(firstValue(node, "color"));
      religions.set(key, {
        key,
        name_zh: locCleanName(loc, key),
        icon_source: texture,
        color,
        heritage_key: stripPrefix(firstScalar(node, "heritage")),
        taboos: nodeItems(asNode(firstValue(node, "taboos")) || { items: [] }).map(stripPrefix).sort(),
        source_file: normalizePath(file),
      });
    }
  }
  return religions;
}

function buildReligionRows(religions, countries, interestGroups, interestGroupTraits, cultureTraits, loc) {
  const countryRowsByReligion = new Map();
  for (const country of countries || []) {
    const key = country.religion?.key || country.religion || "";
    if (!key) continue;
    const rows = countryRowsByReligion.get(key) || [];
    rows.push(country);
    countryRowsByReligion.set(key, rows);
  }
  const devoutGroup = interestGroups.find((group) => group.key === "ig_devout");
  const flavorRows = new Map((devoutGroup?.potential_flavors || []).map((flavor) => [flavor.key, flavor]));
  for (const variant of devoutGroup?.condition_variants || []) {
    if (!flavorRows.has(variant.key)) flavorRows.set(variant.key, variant);
  }
  const conditionFlavorsByRaw = new Map((devoutGroup?.condition_variants || [])
    .filter((variant) => variant.condition_raw)
    .map((variant) => [variant.condition_raw, variant]));
  const countryFlavorRows = new Map();
  for (const country of countries || []) {
    const group = country.interest_groups?.find((item) => item.key === "ig_devout");
    const flavorKey = group?.display_name?.key;
    if (!group) continue;
    if (flavorKey && group.display_name?.is_flavored) {
      const rows = countryFlavorRows.get(flavorKey) || [];
      rows.push({ country, group });
      countryFlavorRows.set(flavorKey, rows);
    }
    for (const rule of group.applied_rules || []) {
      const conditionFlavor = conditionFlavorsByRaw.get(rule.condition_raw);
      if (!conditionFlavor) continue;
      const rows = countryFlavorRows.get(conditionFlavor.key) || [];
      rows.push({ country, group });
      countryFlavorRows.set(conditionFlavor.key, rows);
    }
  }
  const flavorByReligion = new Map([
    ["catholic", ["ig_roman_curia", "ig_catholic_church"]],
    ["protestant", ["ig_church_of_denmark", "ig_church_of_finland", "ig_evangelicals", "ig_evangelical_church", "ig_christian_missionaries", "ig_london_missionary_society", "ig_church_of_norway", "ig_church_of_sweden", "ig_anglican_church", "ig_taiping_god_worshippers"]],
    ["oriental_orthodox", ["ig_oriental_orthodox_church"]],
    ["orthodox", ["ig_orthodox_church"]],
    ["sunni", ["ig_sunni_madrasahs"]],
    ["shiite", ["ig_shia_madrasahs"]],
    ["ibadi", ["ig_ibadi_madrasahs"]],
    ["jewish", ["jewish"]],
    ["mahayana", ["ig_jisha"]],
    ["gelugpa", ["ig_vajrayana_monks"]],
    ["theravada", ["ig_theravada_monks"]],
    ["hindu", ["ig_hindu_priesthood"]],
    ["confucian", ["ig_confucian"]],
    ["shinto", ["ig_shinto_monks"]],
    ["sikh", ["ig_granthis"]],
    ["animist", ["animist"]],
  ]);
  return [...religions.values()].sort((left, right) => left.name_zh.localeCompare(right.name_zh, "zh-Hans-CN") || left.key.localeCompare(right.key)).map((religion) => {
    const countriesForReligion = countryRowsByReligion.get(religion.key) || [];
    let flavors = (flavorByReligion.get(religion.key) || []).flatMap((key) => {
      const flavor = flavorRows.get(key);
      const countryRowsForFlavor = countryFlavorRows.get(key) || [];
      const byTraitSignature = new Map();
      for (const row of countryRowsForFlavor) {
        const traitKeys = (row.group.active_traits || []).map((trait) => trait.key).filter(Boolean).sort();
        const signature = traitKeys.join("|");
        if (!byTraitSignature.has(signature)) byTraitSignature.set(signature, { traitKeys, countries: [] });
        byTraitSignature.get(signature).countries.push(row.country.tag);
      }
      if (modContentRoot && key === "ig_sunni_madrasahs") {
        const turkey = countries.find((country) => country.tag === "TUR")?.interest_groups?.find((group) => group.key === "ig_devout");
        if (turkey) byTraitSignature.set("turkey", { traitKeys: (turkey.active_traits || []).map((trait) => trait.key), countries: ["TUR"] });
      }
      if (!byTraitSignature.size) {
        const sourceTraits = (flavor?.traits || []).map((trait) => trait.key);
        const traitKeys = sourceTraits.length ? sourceTraits : religionDevoutFlavorTraitOverrides(key);
        byTraitSignature.set("potential", { traitKeys, countries: [] });
      }
      return [...byTraitSignature.values()].map((variant, index) => {
        const isTurkey = modContentRoot && key === "ig_sunni_madrasahs" && variant.countries.includes("TUR");
        return {
          key: isTurkey ? "ig_sunni_madrasahs_turkey" : index === 0 ? key : `${key}:${variant.traitKeys.join("|")}`,
          name_zh: isTurkey ? "逊尼派乌理玛（土耳其）" : locCleanName(loc, key),
          name_en: isTurkey ? "Sunni Ulema (Turkey)" : "",
          traits: variant.traitKeys,
          source_file: flavor?.source_file || "",
          country_tags: variant.countries.sort(),
        is_used_by_country: variant.countries.length > 0,
        };
      });
    });
    if (modContentRoot && religion.key === "sunni") {
      flavors = flavors.filter((flavor) => flavor.key !== "ig_sunni_madrasahs_turkey");
      flavors.push({
        key: "ig_sunni_madrasahs_turkey",
        name_zh: "逊尼派乌理玛（土耳其）",
        name_en: "Sunni Ulema (Turkey)",
        traits: ["ig_trait_jihad", "ig_trait_words_remain", "ig_trait_faith_in_chains"],
        source_file: "D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/common/interest_groups/joi_devout.txt",
        country_tags: ["TUR"],
        is_used_by_country: true,
      });
    }
    return {
      id: `religion:${religion.key}`,
      key: religion.key,
      name_zh: religion.name_zh,
      icon_source: religion.icon_source,
      color: religion.color || null,
      heritage_key: religion.heritage_key || "",
      heritage_name_zh: religion.heritage_key ? locCleanName(loc, religion.heritage_key) : "",
      heritage_group_key: cultureTraits.get(religion.heritage_key)?.group_key || "",
      heritage_group_name_zh: cultureTraits.get(religion.heritage_key)?.group_key
        ? locCleanName(loc, cultureTraits.get(religion.heritage_key).group_key)
        : "",
      taboos: religion.taboos || [],
      country_tags: countriesForReligion.map((country) => country.tag).sort(),
      country_count: countriesForReligion.length,
      devout_flavors: flavors,
      source_file: religion.source_file,
    };
  });
}

function religionDevoutFlavorTraitOverrides(flavorKey) {
  if (flavorKey === "ig_taiping_god_worshippers") {
    return ["ig_trait_pious_fiction", "ig_trait_divine_right", "ig_trait_work_ethic"];
  }
  return [];
}

function loadPopNeeds(dirs, loc) {
  const needs = new Map();
  for (const file of listFiles(dirs)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      const node = asNode(assignment.value);
      if (!node || !key.startsWith("popneed_")) continue;
      needs.set(key, {
        key,
        name_zh: locCleanName(loc, key),
        default_good_key: stripPrefix(firstScalar(node, "default")),
        obsession_demand_min: toNumberOrNull(firstScalar(node, "obsession_demand_min")),
        obsession_demand_mult: toNumberOrNull(firstScalar(node, "obsession_demand_mult")),
        prestige_goods_demand_increase: toNumberOrNull(firstScalar(node, "prestige_goods_demand_increase")),
        entries: allValues(node, "entry").map(asNode).filter(Boolean).map((entry) => ({
          goods_key: stripPrefix(firstScalar(entry, "goods")),
          weight: toNumberOrNull(firstScalar(entry, "weight")),
          max_supply_share: toNumberOrNull(firstScalar(entry, "max_supply_share")),
          min_supply_share: toNumberOrNull(firstScalar(entry, "min_supply_share")),
        })),
        wealth_levels: [],
        source_file: normalizePath(file),
      });
    }
  }
  return needs;
}

function loadBuyPackages(dirs) {
  const packagesByLevel = new Map();
  for (const file of listFiles(dirs)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      const match = key.match(/^wealth_(\d+)$/);
      const node = asNode(assignment.value);
      if (!match || !node) continue;
      const level = Number(match[1]);
      const goodsNode = asNode(firstValue(node, "goods"));
      const values = {};
      for (const item of goodsNode?.assignments || []) {
        const needKey = scriptEntryKey(item.key);
        const value = toNumberOrNull(scalarFromValue(item.value));
        if (value != null) values[needKey] = value;
      }
      packagesByLevel.set(level, {
        level,
        political_strength: toNumberOrNull(firstScalar(node, "political_strength")),
        values,
        total: Object.values(values).reduce((sum, value) => sum + value, 0),
        source_file: normalizePath(file),
      });
    }
  }
  const packages = [...packagesByLevel.values()].sort((left, right) => left.level - right.level);
  const levelsByNeedKey = new Map();
  for (const row of packages) {
    for (const needKey of Object.keys(row.values)) {
      if (!levelsByNeedKey.has(needKey)) levelsByNeedKey.set(needKey, []);
      levelsByNeedKey.get(needKey).push(row.level);
    }
  }
  return { levelsByNeedKey, packages };
}

function loadCountryDefinitions(dir) {
  const definitions = new Map();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const tag = scriptEntryKey(assignment.key).toUpperCase();
      if (!/^[A-Z0-9]{3}$/.test(tag)) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      const culturesNode = asNode(firstValue(node, "cultures"));
      const cultures = culturesNode ? nodeItems(culturesNode).map(stripPrefix) : [];
      const color = parseColorValue(firstValue(node, "color"));
      definitions.set(tag, {
        tag,
        country_type: stripPrefix(firstScalar(node, "country_type")) || "recognized",
        tier: stripPrefix(firstScalar(node, "tier")),
        cultures,
        religion: stripPrefix(firstScalar(node, "religion")),
        capital: stripPrefix(firstScalar(node, "capital")),
        color,
        primary_unit_color: firstScalar(node, "primary_unit_color"),
        secondary_unit_color: firstScalar(node, "secondary_unit_color"),
        tertiary_unit_color: firstScalar(node, "tertiary_unit_color"),
        dynamic: firstScalar(node, "dynamic_country_definition") === "yes",
        file: normalizePath(file),
      });
    }
  }
  return definitions;
}

function loadStateHistory(files) {
  const startingOwnersByCountry = new Map();
  const startingOwnersByState = new Map();
  const startingProvinceOwnersByState = new Map();
  const homelandsByState = new Map();
  const stateKeysByCulture = new Map();
  const stateNodes = new Map();
  for (const file of Array.isArray(files) ? files : [files]) {
    if (!file || !fs.existsSync(file)) continue;
    const root = parseScript(readText(file), file);
    const statesNode = asNode(firstValue(root, "STATES"));
    if (!statesNode) continue;
    for (const stateAssignment of statesNode.assignments) {
      const state = stripPrefix(stateAssignment.key);
      const stateNode = asNode(stateAssignment.value);
      if (!state || !stateNode) continue;
      stateNodes.set(state, stateNode);
    }
  }
  for (const [state, stateNode] of stateNodes) {
    const stateProvinceOwners = new Map();
    const fallbackOwners = new Set();
    for (const createState of allValues(stateNode, "create_state")) {
      const createNode = asNode(createState);
      if (!createNode) continue;
      const country = stripPrefix(firstScalar(createNode, "country"));
      if (!country) continue;
      const ownedProvincesNode = asNode(firstValue(createNode, "owned_provinces"));
      const provinceColors = ownedProvincesNode
        ? nodeItems(ownedProvincesNode).map(normalizeProvinceColor).filter(Boolean).sort()
        : [];
      if (!provinceColors.length) {
        fallbackOwners.add(country);
        continue;
      }
      if (!stateProvinceOwners.has(country)) stateProvinceOwners.set(country, new Set());
      for (const provinceColor of provinceColors) {
        for (const colors of stateProvinceOwners.values()) {
          colors.delete(provinceColor);
        }
        stateProvinceOwners.get(country).add(provinceColor);
      }
    }
    const ownerMap = new Map([...stateProvinceOwners.entries()].filter(([, colors]) => colors.size > 0));
    if (ownerMap.size) startingProvinceOwnersByState.set(state, ownerMap);
    for (const country of [...ownerMap.keys(), ...fallbackOwners]) {
      if (!startingOwnersByCountry.has(country)) startingOwnersByCountry.set(country, new Set());
      startingOwnersByCountry.get(country).add(state);
      if (!startingOwnersByState.has(state)) startingOwnersByState.set(state, new Set());
      startingOwnersByState.get(state).add(country);
    }
    for (const homelandValue of allValues(stateNode, "add_homeland")) {
      const culture = stripPrefix(scalarFromValue(homelandValue));
      if (!culture) continue;
      if (!homelandsByState.has(state)) homelandsByState.set(state, new Set());
      homelandsByState.get(state).add(culture);
      pushMapSet(stateKeysByCulture, culture, state);
    }
  }
  return {
    startingOwnersByCountry,
    startingOwnersByState,
    startingProvinceOwnersByState,
    homelandsByState,
    stateKeysByCulture,
  };
}

function loadStartingOwners(file) {
  return loadStateHistory(file).startingOwnersByCountry;
}

function loadStrategicRegions(dir, loc) {
  const regions = new Map();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!key.startsWith("region_")) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      const statesNode = asNode(firstValue(node, "states"));
      const color = parseColorValue(firstValue(node, "map_color"));
      regions.set(key, {
        id: `strategic_region:${key}`,
        key,
        name_zh: locName(loc, key),
        map_color: {
          rgb: color?.rgb || null,
          hex: color?.hex || "",
        },
        capital_province: firstScalar(node, "capital_province"),
        graphical_culture: firstScalar(node, "graphical_culture"),
        states: statesNode ? nodeItems(statesNode).map(stripPrefix).sort() : [],
        source_file: normalizePath(file),
      });
    }
  }
  return regions;
}

function loadGeographicRegions(dir, strategicRegions, loc) {
  const regions = new Map();
  for (const file of listFiles(dir)) {
    if (file.endsWith(".md")) continue;
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!key.startsWith("geographic_region_")) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      const stateRegionsNode = asNode(firstValue(node, "state_regions"));
      const strategicRegionsNode = asNode(firstValue(node, "strategic_regions"));
      const stateKeys = new Set(stateRegionsNode ? nodeItems(stateRegionsNode).map(stripPrefix) : []);
      const strategicRegionKeys = strategicRegionsNode ? nodeItems(strategicRegionsNode).map(stripPrefix) : [];
      for (const strategicRegionKey of strategicRegionKeys) {
        for (const stateKey of strategicRegions.get(strategicRegionKey)?.states || []) {
          stateKeys.add(stateKey);
        }
      }
      const rawName = locName(loc, key);
      regions.set(key, {
        id: `geographic_region:${key}`,
        key,
        name_key: locAliasKey(rawName) || key,
        name_zh: cleanLocalizationText(rawName, loc),
        state_regions: [...stateKeys].sort(),
        strategic_regions: strategicRegionKeys.sort(),
        source_file: normalizePath(file),
      });
    }
  }
  return regions;
}

function loadStateTraits(dir, loc) {
  const traits = new Map();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      const node = asNode(assignment.value);
      if (!node) continue;
      const icon = stripQuotes(firstScalar(node, "icon"));
      if (!key.startsWith("state_trait_") && !icon.includes("/state_trait_icons/")) continue;
      const modifierNodes = allValues(node, "modifier").map(asNode).filter(Boolean);
      const modifiers = modifierNodes
        .flatMap((modifierNode) => modifierNode.assignments.map((item) => modifierRef(item.key, item.value, loc)))
        .filter(Boolean);
      const categories = inferStateTraitCategories(key, icon, modifiers);
      traits.set(key, {
        id: `state_trait:${key}`,
        key,
        name_zh: locName(loc, key),
        icon,
        categories,
        category_zh: joinValues(categories.map((category) => category.name_zh)),
        modifiers,
        modifier_summary_zh: joinValues(modifiers.map((modifier) => modifier.summary_zh)),
        has_mapi: modifiers.some((modifier) => modifier.key === "state_market_access_price_impact"),
        mapi_value_zh: joinValues(modifiers
          .filter((modifier) => modifier.key === "state_market_access_price_impact")
          .map((modifier) => modifier.value_zh)),
        required_techs_for_colonization: nodeItems(asNode(firstValue(node, "required_techs_for_colonization")) || { items: [] }),
        disabling_technologies: nodeItems(asNode(firstValue(node, "disabling_technologies")) || { items: [] }),
        source_file: normalizePath(file),
      });
    }
  }
  return traits;
}

function loadDynamicStateNameVariants(dir, stateDefinitions, loc) {
  const variantsByState = new Map();
  const stateKeys = [...stateDefinitions.keys()].sort((a, b) => b.length - a.length || a.localeCompare(b));
  let order = 1;
  for (const file of listFiles(dir)) {
    if (!path.basename(file).includes("dynamic_state_names")) continue;
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!key.endsWith("_state_name_assign")) continue;
      const stateKey = key.replace(/_state_name_assign$/, "");
      if (!stateDefinitions.has(stateKey)) continue;
      const collected = [];
      collectDynamicStateNameAssignments(assignment.value, "", collected);
      for (const item of collected) {
        const nameKey = stripPrefix(item.name_key);
        if (!nameKey || stateKeyFromDynamicStateNameKey(nameKey, stateKeys) !== stateKey) continue;
        const variant = {
          id: `dynamic_state_name:${stateKey}:${String(order).padStart(4, "0")}`,
          state_key: stateKey,
          order,
          name_key: nameKey,
          name_zh: locName(loc, nameKey),
          trigger_raw: item.trigger_raw || "无条件",
          source_file: normalizePath(file),
        };
        order += 1;
        if (!variantsByState.has(stateKey)) variantsByState.set(stateKey, []);
        variantsByState.get(stateKey).push(variant);
      }
    }
  }
  for (const [stateKey, variants] of variantsByState) {
    variantsByState.set(stateKey, uniqueDynamicStateNameVariants(variants));
  }
  return variantsByState;
}

function loadStateRegionDefinitions(dir, loc, stateTraits = new Map()) {
  const regions = new Map();
  for (const file of listFiles(dir)) {
    if (file.endsWith("state_regions.md")) continue;
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!key.startsWith("STATE_")) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      const traitsNode = asNode(firstValue(node, "traits"));
      const provincesNode = asNode(firstValue(node, "provinces"));
      const impassableNode = asNode(firstValue(node, "impassable"));
      const primeLandNode = asNode(firstValue(node, "prime_land"));
      const arableResourcesNode = asNode(firstValue(node, "arable_resources"));
      const cappedResourcesNode = asNode(firstValue(node, "capped_resources"));
      regions.set(key, {
        id: `state_region:${key}`,
        key,
        name_zh: locName(loc, key),
        numeric_id: toNumberOrNull(firstScalar(node, "id")),
        subsistence_building: firstScalar(node, "subsistence_building"),
        graphical_culture: firstScalar(node, "graphical_culture"),
        province_colors: provincesNode ? nodeItems(provincesNode).map(normalizeProvinceColor).filter(Boolean).sort() : [],
        impassable_province_colors: impassableNode ? nodeItems(impassableNode).map(normalizeProvinceColor).filter(Boolean).sort() : [],
        prime_land_province_colors: primeLandNode ? nodeItems(primeLandNode).map(normalizeProvinceColor).filter(Boolean).sort() : [],
        arable_land: toNumberOrNull(firstScalar(node, "arable_land")),
        arable_resources: arableResourcesNode
          ? nodeItems(arableResourcesNode).map((key) => buildingRef(stripPrefix(key), loc)).sort(sortByNameZh)
          : [],
        capped_resources: cappedResourcesNode ? cappedResourcesNode.assignments.map((item) => ({
          key: stripPrefix(item.key),
          name_zh: locName(loc, stripPrefix(item.key)),
          amount: toNumberOrNull(scalarFromValue(item.value)),
        })).sort(sortByNameZh) : [],
        discoverable_resources: allValues(node, "resource").map((value) => resourceRef(value, loc)).filter(Boolean),
        traits: traitsNode ? nodeItems(traitsNode).map((key) => stateTraitRef(stripPrefix(key), loc, stateTraits)).sort(sortByNameZh) : [],
        source_file: normalizePath(file),
      });
    }
  }
  return regions;
}

function buildStateRegionRows(stateDefinitions, strategicRegions, stateHistory, dynamicStateNameVariantsByState, loc) {
  const strategicRegionKeysByState = new Map();
  for (const strategicRegion of strategicRegions.values()) {
    for (const stateKey of strategicRegion.states || []) {
      pushMapSet(strategicRegionKeysByState, stateKey, strategicRegion.key);
    }
  }
  return [...stateDefinitions.values()]
    .sort((a, b) => stateRegionOrderValue(a.key, stateDefinitions) - stateRegionOrderValue(b.key, stateDefinitions) || a.key.localeCompare(b.key))
    .map((stateRegion) => {
      const strategicRegionKeys = sortStrategicRegionKeys([...(strategicRegionKeysByState.get(stateRegion.key) || [])], strategicRegions);
      const homelandKeys = [...(stateHistory.homelandsByState.get(stateRegion.key) || [])].sort();
      const ownerTags = [...(stateHistory.startingOwnersByState.get(stateRegion.key) || [])].sort();
      const provinceOwnerMap = stateHistory.startingProvinceOwnersByState.get(stateRegion.key) || new Map();
      const provinceOwners = [...provinceOwnerMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([tag, provinceColors]) => ({
          tag,
          name_zh: locName(loc, tag),
          province_colors: [...provinceColors].sort(),
        }));
      return {
        ...stateRegion,
        strategic_regions: strategicRegionKeys.map((key) => strategicRegionRef(key, strategicRegions)),
        homeland_cultures: homelandKeys.map((key) => cultureKeyRef(key, loc)),
        starting_owners: ownerTags.map((tag) => countryKeyRef(tag, loc)),
        starting_province_owners: provinceOwners,
        dynamic_name_variants: dynamicStateNameVariantsByState.get(stateRegion.key) || [],
      };
    });
}

function buildStrategicRegionRows(strategicRegions, stateRegionRows, loc) {
  const stateByKey = new Map(stateRegionRows.map((stateRegion) => [stateRegion.key, stateRegion]));
  return [...strategicRegions.values()]
    .sort((a, b) => strategicRegionOrderValue(a.key) - strategicRegionOrderValue(b.key) || a.key.localeCompare(b.key))
    .map((strategicRegion) => {
      const states = sortStateRegionKeys(strategicRegion.states || [], stateByKey)
        .map((stateKey) => stateByKey.get(stateKey))
        .filter(Boolean);
      const homelandCultureKeys = unique(states.flatMap((stateRegion) => stateRegion.homeland_cultures.map((culture) => culture.key))).sort();
      const ownerTags = unique(states.flatMap((stateRegion) => stateRegion.starting_owners.map((country) => country.tag))).sort();
      return {
        ...strategicRegion,
        states: states.map((stateRegion) => stateRegionRef(stateRegion.key, stateByKey, loc)),
        homeland_cultures: homelandCultureKeys.map((key) => cultureKeyRef(key, loc)),
        starting_owners: ownerTags.map((tag) => countryKeyRef(tag, loc)),
      };
    });
}

function loadHistoryCountryTags(dir) {
  const tags = new Set();
  for (const file of listFiles(dir)) {
    const text = readText(file);
    for (const match of text.matchAll(/\bc:([A-Z0-9]{3})\s*\?=/g)) {
      tags.add(match[1]);
    }
  }
  return tags;
}

function loadStartingTechnologyTemplates(dirs, technologies) {
  const technologyKeys = new Set(technologies.map((technology) => technology.key));
  const templates = new Map();
  for (const file of listEffectiveFiles(dirs)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const match = assignment.key.match(/^effect_starting_technology_tier_(\d+)_tech$/);
      if (!match) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      templates.set(Number(match[1]), {
        key: assignment.key,
        technology_keys: [...new Set(node.assignments
          .filter((item) => item.key === "add_technology_researched")
          .map((item) => stripPrefix(scalarFromValue(item.value)))
          .filter((key) => technologyKeys.has(key)))],
        eras: [...new Set(node.assignments
          .filter((item) => item.key === "add_era_researched")
          .map((item) => stripPrefix(scalarFromValue(item.value)))
          .filter(Boolean))],
        source_file: normalizePath(file),
      });
    }
  }
  return templates;
}

function loadStartingCountryData(dirs, technologies, laws, amendments, lawGroups, scriptedEffectDirs, definitions, cultures, startingTechnologyTemplates, loc) {
  const technologyByKey = new Map(technologies.map((technology) => [technology.key, technology]));
  const lawByKey = new Map([...laws.values()].map((law) => [law.key, law]));
  const amendmentByKey = new Map((amendments || []).map((amendment) => [amendment.key, amendment]));
  const startingPoliticsEffects = loadStartingPoliticsEffects(scriptedEffectDirs);
  const dataByTag = new Map();
  for (const file of listEffectiveFiles(dirs)) {
    const root = parseScript(readText(file), file);
    const countriesNode = asNode(firstValue(root, "COUNTRIES")) || root;
    for (const assignment of countriesNode.assignments) {
      const tag = stripPrefix(scriptEntryKey(assignment.key)).toUpperCase();
      if (!/^[A-Z0-9]{3}$/.test(tag)) continue;
      const countryNode = asNode(assignment.value);
      if (!countryNode) continue;
      const tierAssignment = countryNode.assignments.find((item) => /^effect_starting_technology_tier_\d+_tech$/.test(item.key));
      const technologyTier = tierAssignment
        ? Number(tierAssignment.key.match(/^effect_starting_technology_tier_(\d+)_tech$/)[1])
        : null;
      const technologyKeys = countryNode.assignments
        .filter((item) => item.key === "add_technology_researched")
        .map((item) => stripPrefix(scalarFromValue(item.value)))
        .filter((key) => technologyByKey.has(key));
      const template = Number.isFinite(technologyTier) ? startingTechnologyTemplates.get(technologyTier) : null;
      const templateTechnologyKeys = template?.technology_keys || [];
      const lawEntries = new Map();
      const context = startingPoliticsContext(tag, definitions, cultures);
      const politicsEffectKey = countryNode.assignments
        .find((item) => item.key.startsWith("effect_starting_politics_") && scalarFromValue(item.value) === "yes")
        ?.key || "";
      const politicsEffect = politicsEffectKey ? startingPoliticsEffects.get(politicsEffectKey) : null;
      for (const group of lawGroups.values()) {
        if (["lawgroup_caste_hegemony", "lawgroup_edo_social_system"].includes(group.key)) continue;
        const defaultLaw = [...lawByKey.values()]
          .filter((law) => law.group_key === group.key)
          .sort((left, right) => left.sort_order - right.sort_order || left.key.localeCompare(right.key))[0];
        if (defaultLaw) addStartingLawEntry(lawEntries, defaultLaw.key, "law_group_default", group.key, lawByKey, lawGroups, loc);
      }
      for (const key of collectStartingPoliticsLaws(politicsEffect, context)) {
        addStartingLawEntry(lawEntries, key, "starting_politics_effect", politicsEffectKey, lawByKey, lawGroups, loc);
      }
      for (const item of countryNode.assignments) {
        if (item.key !== "activate_law") continue;
        const key = stripPrefix(scalarFromValue(item.value));
        if (!lawByKey.has(key)) continue;
        addStartingLawEntry(lawEntries, key, "country_history", normalizePath(file), lawByKey, lawGroups, loc);
      }
      for (const assignment of countryNode.assignments) {
        if (!assignment.key.startsWith("active_law:")) continue;
        const lawGroupKey = stripPrefix(assignment.key.slice("active_law:".length));
        const amendmentNode = asNode(assignment.value);
        if (!lawGroupKey || !amendmentNode) continue;
        const entry = lawEntries.get(lawGroupKey);
        if (!entry) continue;
        const amendmentKeys = amendmentNode.assignments
          .filter((item) => item.key === "add_amendment")
          .map((item) => stripPrefix(firstScalar(asNode(item.value) || { assignments: [] }, "type")))
          .filter(Boolean);
        if (amendmentKeys.length) entry.law.starting_amendments = amendmentKeys.map((key) => amendmentRef(key, amendmentByKey));
      }
      dataByTag.set(tag, {
        technology_tier: Number.isFinite(technologyTier) ? technologyTier : null,
        technology_template: template?.key || "",
        technology_eras: template?.eras || [],
        template_technologies: templateTechnologyKeys.map((key) => technologyRef(key, technologyByKey, loc)),
        technologies: [...new Set(technologyKeys)].map((key) => technologyRef(key, technologyByKey, loc)),
        laws: [...lawEntries.values()].map((entry) => entry.law),
        source_file: normalizePath(file),
      });
    }
  }
  return dataByTag;
}

function loadStartingPoliticsEffects(dirs) {
  const effects = new Map();
  for (const file of listEffectiveFiles(dirs)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      if (!assignment.key.startsWith("effect_starting_politics_")) continue;
      const node = asNode(assignment.value);
      if (node) effects.set(assignment.key, node);
    }
  }
  return effects;
}

function startingPoliticsContext(tag, definitions, cultures) {
  const definition = definitions.get(tag);
  const cultureReligion = (definition?.cultures || [])
    .map((key) => cultures.get(key)?.religion)
    .find(Boolean) || "";
  const religion = definition?.religion || cultureReligion;
  return {
    isIslamic: ["sunni", "shiite", "ibadi"].includes(religion),
    isDecentralized: definition?.country_type === "decentralized",
  };
}

function collectStartingPoliticsLaws(node, context) {
  if (!node) return [];
  const laws = [];
  for (let index = 0; index < node.assignments.length; index += 1) {
    const assignment = node.assignments[index];
    if (assignment.key === "activate_law") {
      const key = stripPrefix(scalarFromValue(assignment.value));
      if (key) laws.push(key);
      continue;
    }
    if (assignment.key !== "if") continue;
    const branch = asNode(assignment.value);
    if (!branch) continue;
    const limit = asNode(firstValue(branch, "limit"));
    const condition = evaluateStartingPoliticsCondition(limit, context);
    const selected = condition ? branch : null;
    if (selected) laws.push(...collectStartingPoliticsLaws(selected, context));
    const next = node.assignments[index + 1];
    if (!condition && next?.key === "else") {
      const elseNode = asNode(next.value);
      if (elseNode) laws.push(...collectStartingPoliticsLaws(elseNode, context));
      index += 1;
    }
  }
  return laws;
}

function evaluateStartingPoliticsCondition(node, context) {
  if (!node) return false;
  for (const assignment of node.assignments) {
    if (assignment.key === "country_is_islamic") return scalarFromValue(assignment.value) === "yes" ? context.isIslamic : !context.isIslamic;
    if (assignment.key === "is_country_type") return stripPrefix(scalarFromValue(assignment.value)) === "decentralized" ? context.isDecentralized : false;
    if (assignment.key === "NOT") return !evaluateStartingPoliticsCondition(asNode(assignment.value), context);
    if (assignment.key === "OR") return asNode(assignment.value)?.assignments.some((item) => evaluateStartingPoliticsCondition({ assignments: [item] }, context)) || false;
    if (assignment.key === "NOR") return !(asNode(assignment.value)?.assignments.some((item) => evaluateStartingPoliticsCondition({ assignments: [item] }, context)) || false);
  }
  return false;
}

function addStartingLawEntry(entries, key, source, sourceDetail, lawByKey, lawGroups, loc) {
  const law = lawByKey.get(key);
  if (!law) return;
  const group = lawGroups.get(law.group_key);
  entries.set(law.group_key, {
    law: lawRef(key, lawByKey, loc, {
      source,
      source_detail: sourceDetail,
      category: group?.category || "",
      group_sort_order: group?.sort_order ?? null,
    }),
    source,
    source_detail: sourceDetail,
  });
}

function loadHistoryReligionOverrides(dir) {
  const overrides = new Map();
  for (const file of listFiles(dir)) {
    const text = readText(file);
    const tagMatch = text.match(/\bc:([A-Z0-9]{3})\s*\?=/);
    if (!tagMatch) continue;
    const religionMatch = text.match(/\bset_state_religion\s*=\s*rel:([A-Za-z0-9_]+)/);
    if (!religionMatch) continue;
    overrides.set(tagMatch[1], {
      religion: religionMatch[1],
      file: normalizePath(file),
    });
  }
  return overrides;
}

function loadStartingSubjectRelationships(files) {
  const colorBorrowingTypes = new Set([
    "puppet",
    "vassal",
    "crown_land",
    "chartered_company",
    "colony",
    "dominion",
    "personal_union",
  ]);
  const subjectsByTag = new Map();
  for (const file of Array.isArray(files) ? files : [files]) {
    if (!file || !fs.existsSync(file)) continue;
    const root = parseScript(readText(file), file);
    const diplomacy = asNode(firstValue(root, "DIPLOMACY")) || root;
    for (const assignment of diplomacy.assignments) {
      const overlordTag = stripPrefix(scriptEntryKey(assignment.key)).toUpperCase();
      if (!/^[A-Z0-9]{3}$/.test(overlordTag)) continue;
      const overlordNode = asNode(assignment.value);
      if (!overlordNode) continue;
      for (const pactAssignment of overlordNode.assignments) {
        if (pactAssignment.key !== "create_diplomatic_pact") continue;
        const pact = asNode(pactAssignment.value);
        if (!pact) continue;
        const subjectTag = stripPrefix(firstValue(pact, "country")).toUpperCase();
        const type = stripPrefix(firstValue(pact, "type"));
        if (!/^[A-Z0-9]{3}$/.test(subjectTag) || !type) continue;
        subjectsByTag.set(subjectTag, {
          overlord_tag: overlordTag,
          type,
          uses_overlord_color: colorBorrowingTypes.has(type),
        });
      }
    }
  }
  return subjectsByTag;
}

function loadStartingDiplomacy(dirs) {
  const recordsByTag = new Map();
  const subjectTypes = new Set([
    "puppet",
    "vassal",
    "crown_land",
    "chartered_company",
    "colony",
    "dominion",
    "personal_union",
    "protectorate",
    "tributary",
  ]);
  const add = (tag, record) => {
    if (!tag || !record?.target_tag || tag === record.target_tag) return;
    const records = recordsByTag.get(tag) || [];
    const signature = [record.type, record.target_tag, record.subject_type || "", record.subject_role || "", record.pact_type || "", record.value ?? "", record.months ?? ""].join("|");
    if (!records.some((item) => [item.type, item.target_tag, item.subject_type || "", item.subject_role || "", item.pact_type || "", item.value ?? "", item.months ?? ""].join("|") === signature)) records.push(record);
    recordsByTag.set(tag, records);
  };
  for (const file of listEffectiveFiles(dirs)) {
    const source = readText(file);
    const root = parseScript(source, file);
    const diplomacy = asNode(firstValue(root, "DIPLOMACY")) || root;
    for (const assignment of diplomacy.assignments) {
      const sourceTag = stripPrefix(scriptEntryKey(assignment.key)).toUpperCase();
      if (!/^[A-Z0-9]{3}$/.test(sourceTag)) continue;
      const sourceLine = sourceLineNumber(source, `c:${sourceTag}`);
      const sourceNode = asNode(assignment.value);
      if (!sourceNode) continue;
      for (const item of sourceNode.assignments) {
        if (item.key === "create_diplomatic_pact") {
          const pact = asNode(item.value);
          const targetTag = stripPrefix(firstValue(pact, "country")).toUpperCase();
          const pactType = stripPrefix(firstScalar(pact, "type"));
          if (!/^[A-Z0-9]{3}$/.test(targetTag) || !pactType) continue;
          if (subjectTypes.has(pactType)) {
            add(sourceTag, { type: "subject", target_tag: targetTag, subject_type: pactType, subject_role: "overlord", source_file: normalizePath(file), source_line: sourceLine });
            add(targetTag, { type: "subject", target_tag: sourceTag, subject_type: pactType, subject_role: "subject", source_file: normalizePath(file), source_line: sourceLine });
          } else if (pactType === "rivalry") {
            add(sourceTag, { type: "rivalry", target_tag: targetTag, source_file: normalizePath(file), source_line: sourceLine });
          } else if (pactType === "embargo") {
            add(sourceTag, { type: "embargo", target_tag: targetTag, source_file: normalizePath(file), source_line: sourceLine });
          } else {
            add(sourceTag, { type: "pact", target_tag: targetTag, pact_type: pactType, source_file: normalizePath(file), source_line: sourceLine });
          }
          continue;
        }
        if (item.key === "create_bidirectional_truce") {
          const truce = asNode(item.value);
          const targetTag = stripPrefix(firstValue(truce, "country")).toUpperCase();
          const months = toNumberOrNull(firstScalar(truce, "months"));
          if (!/^[A-Z0-9]{3}$/.test(targetTag)) continue;
          const record = { type: "truce", target_tag: targetTag, months, source_file: normalizePath(file), source_line: sourceLine };
          add(sourceTag, record);
          add(targetTag, { ...record, target_tag: sourceTag });
          continue;
        }
        if (item.key === "set_relations") {
          const relation = asNode(item.value);
          const targetTag = stripPrefix(firstValue(relation, "country")).toUpperCase();
          const value = toNumberOrNull(firstScalar(relation, "value"));
          if (!/^[A-Z0-9]{3}$/.test(targetTag) || value == null) continue;
          add(sourceTag, { type: "relation", target_tag: targetTag, value, source_file: normalizePath(file), source_line: sourceLine });
          continue;
        }
        if (item.key === "set_owes_obligation_to") {
          const obligation = asNode(item.value);
          const targetTag = stripPrefix(firstValue(obligation, "country")).toUpperCase();
          if (!/^[A-Z0-9]{3}$/.test(targetTag) || firstScalar(obligation, "setting") !== "yes") continue;
          add(sourceTag, { type: "obligation", target_tag: targetTag, source_file: normalizePath(file), source_line: sourceLine });
        }
      }
    }
  }
  for (const records of recordsByTag.values()) records.sort((left, right) => left.type.localeCompare(right.type) || left.target_tag.localeCompare(right.target_tag));
  return recordsByTag;
}

function sourceLineNumber(source, token) {
  const index = source.indexOf(token);
  return index < 0 ? 1 : source.slice(0, index).split("\n").length;
}

function loadCountryRules(dir, kind) {
  const rules = new Map();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const tag = scriptEntryKey(assignment.key).toUpperCase();
      if (!/^[A-Z0-9]{3}$/.test(tag)) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      const statesNode = asNode(firstValueAnyCase(node, "states"));
      const states = statesNode ? nodeItems(statesNode).map(stripPrefix) : [];
      const cultureRefs = [...collectScalarRefs(node, "cu:")].map(stripPrefix).sort();
      const tagRefs = [...collectScalarRefs(node, "c:")].map(stripPrefix).sort();
      rules.set(tag, {
        kind,
        tag,
        use_culture_states: firstScalar(node, "use_culture_states") === "yes",
        is_major_formable: firstScalar(node, "is_major_formation") === "yes",
        required_states_fraction: firstScalar(node, "required_states_fraction"),
        required_num_states: firstScalar(node, "required_num_states"),
        states,
        geographic_region: stripPrefix(firstScalar(node, "geographic_region")),
        required_cultures: cultureRefs,
        referenced_tags: tagRefs,
        file: normalizePath(file),
      });
    }
  }
  return rules;
}

function loadDynamicCountryNames(dir, loc) {
  const rows = [];
  const scopeEntries = new Map();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const scope = scriptEntryKey(assignment.key).toUpperCase();
      if (!/^[A-Z0-9]{3}$/.test(scope) && scope !== "DEFAULT") continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      scopeEntries.set(scope, { node, file });
    }
  }
  const orderByScope = new Map();
  for (const [scope, entry] of scopeEntries) {
    const values = allValues(entry.node, "dynamic_country_name");
    values.forEach((value) => {
      const variantNode = asNode(value);
      if (!variantNode) return;
      const order = (orderByScope.get(scope) || 0) + 1;
      orderByScope.set(scope, order);
      const nameKey = firstScalar(variantNode, "name");
      const adjectiveKey = firstScalar(variantNode, "adjective");
      const trigger = firstValue(variantNode, "trigger");
      rows.push({
        id: `dynamic_country_name:${scope}:${String(order).padStart(3, "0")}`,
        scope,
        country_tag: scope === "DEFAULT" ? "" : scope,
        order,
        name_key: nameKey,
        name_zh: nameKey ? locName(loc, nameKey) : "",
        adjective_key: adjectiveKey,
        adjective_zh: adjectiveKey ? locName(loc, adjectiveKey) : "",
        priority: firstScalar(variantNode, "priority"),
        is_revolutionary: firstScalar(variantNode, "is_revolutionary") === "yes" ? "是" : "否",
        referenced_tags: joinValues([...collectTagRefs(trigger)].sort()),
        referenced_cultures: joinValues([...collectScalarRefs(trigger, "cu:")].map(stripPrefix).sort()),
        referenced_laws: joinValues([...collectScalarRefs(trigger, "law_type:")].map(stripPrefix).sort()),
        referenced_journal_entries: joinValues([...collectScalarRefs(trigger, "je_")].sort()),
        referenced_variables: joinValues([...collectVariableRefs(trigger)].sort()),
        trigger_raw: stringifyScriptValue(trigger),
        source_file: normalizePath(entry.file),
      });
    });
  }
  return rows.sort((a, b) => a.scope.localeCompare(b.scope) || a.order - b.order);
}

function loadDynamicCountryMapColors(dir, namedColors) {
  const rows = new Map();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      const node = asNode(assignment.value);
      if (!node) continue;
      const colorKey = firstScalar(node, "color");
      const color = namedColors.get(colorKey) || null;
      const possible = firstValue(node, "possible");
      const referencedTags = [...collectTagRefs(possible)].sort();
      rows.set(key, {
        id: `dynamic_map_color:${key}`,
        key,
        color_key: colorKey,
        color_model: color?.model || "",
        color_raw: color?.raw || "",
        color_rgb: color?.rgb ? color.rgb.join(" ") : "",
        color_hex: color?.hex || "",
        referenced_tags: joinValues(referencedTags),
        primary_tag: referencedTags.length === 1 ? referencedTags[0] : "",
        referenced_cultures: joinValues([...collectScalarRefs(possible, "cu:")].map(stripPrefix).sort()),
        referenced_laws: joinValues([...collectScalarRefs(possible, "law_type:")].map(stripPrefix).sort()),
        referenced_variables: joinValues([...collectVariableRefs(possible)].sort()),
        possible_raw: stringifyScriptValue(possible),
        source_file: normalizePath(file),
      });
    }
  }
  return [...rows.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function loadCompanies(dir, loc, stateRegionRows, strategicRegionRows) {
  const companies = new Map();
  const stateRegionByKey = new Map(stateRegionRows.map((stateRegion) => [stateRegion.key, stateRegion]));
  const strategicRegionByKey = new Map(strategicRegionRows.map((region) => [region.key, region]));
  for (const file of listFiles(dir)) {
    const sourceFileName = path.basename(file);
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!key.startsWith("company_")) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      const buildingTypes = companyBuildingRefs(firstValue(node, "building_types"), loc);
      const extensionBuildingTypes = companyBuildingRefs(firstValue(node, "extension_building_types"), loc);
      const possiblePrestigeGoods = prestigeGoodRefs(firstValue(node, "possible_prestige_goods"), loc);
      const preferredHeadquarters = companyStateRegionRefs(firstValue(node, "preferred_headquarters"), stateRegionByKey, loc);
      const possibleValue = firstValue(node, "possible");
      const aiWillDoValue = firstValue(node, "ai_will_do");
      const scriptValues = [
        firstValue(node, "potential"),
        firstValue(node, "attainable"),
        possibleValue,
        firstValue(node, "prestige_goods_trigger"),
        aiWillDoValue,
        firstValue(node, "ai_construction_targets"),
        firstValue(node, "ai_weight"),
      ].filter(Boolean);
      const flavoredCompany = boolFromYesNo(firstScalar(node, "flavored_company"));
      const companyKind = companyKindRef(key, flavoredCompany, sourceFileName);
      const prestigeGoodsKind = companyPrestigeGoodsKind(possiblePrestigeGoods);
      const dlcRef = companyDlcRef(scriptValues);
      const referencedStateKeys = sortStateRegionKeys([
        ...preferredHeadquarters.map((stateRegion) => stateRegion.key),
        ...scriptValues.flatMap((value) => [...collectStateRegionRefs(value)]),
      ], stateRegionByKey);
      const referencedStrategicRegionKeys = sortStrategicRegionKeys(
        scriptValues.flatMap((value) => [...collectStrategicRegionRefs(value)]),
        strategicRegionByKey,
      );
      const prosperityModifiers = allValues(node, "prosperity_modifier")
        .map(asNode)
        .filter(Boolean)
        .flatMap((modifierNode) => modifierNode.assignments.map((item) => modifierRef(item.key, item.value, loc)));
      const category = firstScalar(node, "category");
      companies.set(key, {
        id: `company:${key}`,
        key,
        name_zh: locName(loc, key),
        desc_zh: loc.has(`${key}_desc`) ? cleanLocalizationText(locName(loc, `${key}_desc`), loc) : "",
        icon: stripQuotes(firstScalar(node, "icon")),
        background: stripQuotes(firstScalar(node, "background")),
        category,
        category_zh: category ? locName(loc, `company_category_${category}`) : "",
        flavored_company: flavoredCompany,
        company_kind: companyKind.key,
        company_kind_zh: companyKind.name_zh,
        is_easter_egg_company: companyKind.key === "easter_egg",
        uses_dynamic_naming: boolFromYesNo(firstScalar(node, "uses_dynamic_naming")),
        dynamic_company_type_names: nodeItems(asNode(firstValue(node, "dynamic_company_type_names")) || { items: [] }).map((key) => ({
          key,
          name_zh: locName(loc, key),
        })),
        preferred_headquarters: preferredHeadquarters,
        building_types: buildingTypes,
        extension_building_types: extensionBuildingTypes,
        possible_prestige_goods: possiblePrestigeGoods,
        has_prestige_goods: possiblePrestigeGoods.length > 0,
        has_generic_prestige_goods: prestigeGoodsKind.hasGeneric,
        has_special_prestige_goods: prestigeGoodsKind.hasSpecial,
        prestige_goods_kind: prestigeGoodsKind.key,
        prestige_goods_kind_zh: prestigeGoodsKind.name_zh,
        dlc_key: dlcRef.key,
        dlc_name_zh: dlcRef.name_zh,
        dlc_name_en: dlcRef.name_en,
        dlc_icon: dlcRef.icon,
        prosperity_modifiers: prosperityModifiers,
        prosperity_modifier_summary_zh: joinValues(prosperityModifiers.map((modifier) => modifier.summary_zh)),
        required_technologies: unique([...collectTechnologyRefs(possibleValue)]).sort().map((key) => ({
          key,
          name_zh: locName(loc, key),
        })),
        ai_will_do_technologies: unique([...collectTechnologyRefs(aiWillDoValue)]).sort().map((key) => ({
          key,
          name_zh: locName(loc, key),
        })),
        referenced_state_regions: referencedStateKeys.map((key) => stateRegionRef(key, stateRegionByKey, loc)),
        referenced_strategic_regions: referencedStrategicRegionKeys.map((key) => strategicRegionRef(key, strategicRegionByKey)),
        referenced_geographic_regions: unique(scriptValues.flatMap((value) => [...collectGeographicRegionRefs(value)])).sort().map((key) => ({
          key,
          name_zh: locName(loc, key),
        })),
        referenced_cultures: unique(scriptValues.flatMap((value) => [...collectCultureRefs(value)])).sort().map((key) => cultureKeyRef(key, loc)),
        referenced_countries: unique(scriptValues.flatMap((value) => [...collectTagRefs(value)])).sort().map((tag) => ({
          id: `country:${tag}`,
          tag,
          name_zh: locName(loc, tag),
        })),
        referenced_buildings: unique([
          ...buildingTypes.map((building) => building.key),
          ...extensionBuildingTypes.map((building) => building.key),
          ...scriptValues.flatMap((value) => [...collectBuildingRefs(value)]),
        ]).sort().map((key) => buildingRef(key, loc)),
        potential_raw: stringifyScriptValue(firstValue(node, "potential")),
        attainable_raw: stringifyScriptValue(firstValue(node, "attainable")),
        possible_raw: stringifyScriptValue(firstValue(node, "possible")),
        prestige_goods_trigger_raw: stringifyScriptValue(firstValue(node, "prestige_goods_trigger")),
        ai_will_do_raw: stringifyScriptValue(firstValue(node, "ai_will_do")),
        ai_construction_targets_raw: stringifyScriptValue(firstValue(node, "ai_construction_targets")),
        ai_weight_raw: stringifyScriptValue(firstValue(node, "ai_weight")),
        source_file: normalizePath(file),
      });
    }
  }
  return [...companies.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function companyKindRef(key, flavoredCompany, sourceFileName) {
  if (key === "company_paradox" || sourceFileName === "00_companies_totally_normal.txt") {
    return { key: "easter_egg", name_zh: "彩蛋公司" };
  }
  if (flavoredCompany) return { key: "historical", name_zh: "史实公司" };
  return { key: "generic", name_zh: "通用公司" };
}

function companyPrestigeGoodsKind(prestigeGoods) {
  const keys = (prestigeGoods || []).map((item) => item.key).filter(Boolean);
  const hasGeneric = keys.some((key) => key.startsWith("prestige_good_generic_"));
  const hasSpecial = keys.some((key) => key && !key.startsWith("prestige_good_generic_"));
  if (!keys.length) {
    return { key: "none", name_zh: "无名贵商品", hasGeneric: false, hasSpecial: false };
  }
  if (hasGeneric && hasSpecial) {
    return { key: "mixed", name_zh: "通用和特殊名贵商品", hasGeneric, hasSpecial };
  }
  if (hasGeneric) {
    return { key: "generic_only", name_zh: "通用名贵商品", hasGeneric, hasSpecial };
  }
  return { key: "special_only", name_zh: "特殊名贵商品", hasGeneric, hasSpecial };
}

function companyDlcRef(scriptValues) {
  const dlcFeatures = unique(scriptValues.flatMap((value) => [...collectAssignedScalarValues(value, "has_dlc_feature")])).sort();
  const dlcRefs = dlcFeatures.map((feature) => companyDlcByFeature.get(feature)).filter(Boolean);
  return dlcRefs[0] || baseGameDlcRef;
}

function loadCompanyCharterTypes(dir, loc) {
  const rows = new Map();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!isPlainTagLike(key)) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      rows.set(key, {
        id: `company_charter_type:${key}`,
        key,
        name_zh: locName(loc, key),
        desc_zh: loc.has(`${key}_desc`) ? cleanLocalizationText(locName(loc, `${key}_desc`), loc) : "",
        type: firstScalar(node, "type"),
        icon: stripQuotes(firstScalar(node, "icon")),
        additional_input: boolFromYesNo(firstScalar(node, "additional_input")),
        possible_raw: stringifyScriptValue(firstValue(node, "possible")),
        ai_possible_raw: stringifyScriptValue(firstValue(node, "ai_possible")),
        ai_weight_raw: stringifyScriptValue(firstValue(node, "ai_weight")),
        source_file: normalizePath(file),
      });
    }
  }
  return [...rows.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function loadInterestGroupTraits(dir, loc) {
  const rows = new Map();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!key.startsWith("ig_trait_") && !key.startsWith("ig_")) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      const modifiers = allValues(node, "modifier")
        .map(asNode)
        .filter(Boolean)
        .flatMap((modifierNode) => modifierNode.assignments.map((item) => modifierRef(item.key, item.value, loc)));
      rows.set(key, {
        id: `interest_group_trait:${key}`,
        key,
        name_zh: locCleanName(loc, key),
        desc_zh: loc.has(`${key}_desc`) ? cleanLocalizationText(locName(loc, `${key}_desc`), loc) : "",
        icon: stripQuotes(firstScalar(node, "icon")),
        min_approval: firstScalar(node, "min_approval"),
        max_approval: firstScalar(node, "max_approval"),
        modifiers,
        modifier_summary_zh: joinValues(modifiers.map((modifier) => modifier.summary_zh)),
        source_file: normalizePath(file),
      });
    }
  }
  return rows;
}

function loadIdeologies(dir, loc) {
  const rows = new Map();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!key.startsWith("ideology_")) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      const characterIdeology = boolFromYesNo(firstScalar(node, "character_ideology"));
      const lawStances = [];
      for (const lawGroupAssignment of node.assignments) {
        if (!lawGroupAssignment.key.startsWith("lawgroup_")) continue;
        const lawGroupNode = asNode(lawGroupAssignment.value);
        if (!lawGroupNode) continue;
        for (const lawAssignment of lawGroupNode.assignments) {
          lawStances.push({
            law_group_key: lawGroupAssignment.key,
            law_group_name_zh: locName(loc, lawGroupAssignment.key),
            law_key: lawAssignment.key,
            law_name_zh: locName(loc, lawAssignment.key),
            stance: scalarFromValue(lawAssignment.value),
          });
        }
      }
      rows.set(key, {
        id: `ideology:${key}`,
        key,
        name_zh: locCleanName(loc, key),
        desc_zh: loc.has(`${key}_desc`) ? cleanLocalizationText(locName(loc, `${key}_desc`), loc) : "",
        icon: stripQuotes(firstScalar(node, "icon")),
        character_ideology: characterIdeology,
        law_stances: lawStances,
        character_requirements: characterIdeology ? characterIdeologyRequirements(node, loc) : null,
        interest_group_leader_weight: characterIdeology ? ideologyWeightSummary(firstValue(node, "interest_group_leader_weight"), loc) : null,
        non_interest_group_leader_weight: characterIdeology ? ideologyWeightSummary(firstValue(node, "non_interest_group_leader_weight"), loc) : null,
        source_file: normalizePath(file),
      });
    }
  }
  return rows;
}

function loadLawGroups(dir, loc) {
  const rows = new Map();
  let sortOrder = 0;
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!key.startsWith("lawgroup_")) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      rows.set(key, {
        id: `law_group:${key}`,
        key,
        sort_order: sortOrder++,
        name_zh: locCleanName(loc, key),
        category: firstScalar(node, "law_group_category"),
        base_enactment_days: toNumberOrNull(firstScalar(node, "base_enactment_days")),
        enactment_approval_mult: toNumberOrNull(firstScalar(node, "enactment_approval_mult")),
        ideological_opinion_impact: toNumberOrNull(firstScalar(node, "ideological_opinion_impact")),
        affected_by_regime_change: boolFromYesNo(firstScalar(node, "affected_by_regime_change")),
        enable: conditionSummaryObject(firstValue(node, "enable"), loc),
        change_allowed_trigger: conditionSummaryObject(firstValue(node, "change_allowed_trigger"), loc),
        source_file: normalizePath(file),
      });
    }
  }
  return rows;
}

function loadInstitutions(dir, loc) {
  const rows = new Map();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!key.startsWith("institution_")) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      rows.set(key, {
        key,
        name_zh: locCleanName(loc, key),
        modifiers: allValues(node, "modifier").map(asNode).filter(Boolean)
          .flatMap((modifierNode) => modifierNode.assignments.map((item) => modifierRef(item.key, item.value, loc))),
      });
    }
  }
  return rows;
}

function loadLawAmendments(dir, loc) {
  const rows = [];
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!key.startsWith("amendment_")) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      rows.push({
        key,
        id: `law_amendment:${key}`,
        name_zh: locCleanName(loc, key),
        desc_zh: loc.has(`${key}_desc`) ? cleanLocalizationText(locName(loc, `${key}_desc`), loc) : "",
        parent_law: firstScalar(node, "parent"),
        allowed_laws: nodeItems(asNode(firstValue(node, "allowed_laws")) || { items: [] }),
        modifiers: allValues(node, "modifier").map(asNode).filter(Boolean)
          .flatMap((modifierNode) => modifierNode.assignments.map((item) => modifierRef(item.key, item.value, loc))),
        possible: conditionSummaryObject(firstValue(node, "possible"), loc),
        loc: { name: `law:${firstScalar(node, "parent") || "unknown"}:${key}.name`, description: `law:${firstScalar(node, "parent") || "unknown"}:${key}.description` },
        source_file: normalizePath(file),
      });
    }
  }
  return rows;
}

function attachLawAmendments(laws, amendments) {
  for (const law of laws.values()) law.amendments = [];
  for (const amendment of amendments) {
    const keys = new Set([amendment.parent_law, ...(amendment.allowed_laws || [])].filter(Boolean));
    for (const key of keys) {
      const law = laws.get(key);
      if (law) law.amendments.push(amendment);
    }
  }
  for (const law of laws.values()) law.amendments.sort((a, b) => (a.name_zh || a.key).localeCompare(b.name_zh || b.key, "zh-Hans-CN"));
}

function loadLaws(dir, lawGroups, institutions, loc) {
  const rows = new Map();
  let sortOrder = 0;
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!key.startsWith("law_")) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      const groupKey = firstScalar(node, "group");
      const modifiers = allValues(node, "modifier")
        .map(asNode)
        .filter(Boolean)
        .flatMap((modifierNode) => modifierNode.assignments.map((item) => modifierRef(item.key, item.value, loc)));
      const institutionKey = firstScalar(node, "institution");
      const institutionModifiers = allValues(node, "institution_modifier")
        .map(asNode)
        .filter(Boolean)
        .flatMap((modifierNode) => modifierNode.assignments.map((item) => modifierRef(item.key, item.value, loc)));
      rows.set(key, {
        id: `law:${key}`,
        key,
        sort_order: sortOrder++,
        name_zh: locCleanName(loc, key),
        group_key: groupKey,
        group_name_zh: lawGroups.get(groupKey)?.name_zh || locCleanName(loc, groupKey),
        icon: stripQuotes(firstScalar(node, "icon")),
        progressiveness: toNumberOrNull(firstScalar(node, "progressiveness")),
        modifiers,
        modifier_summary_zh: joinValues(modifiers.map((modifier) => modifier.summary_zh)),
        unlocking_technologies: refsToObjects(nodeItems(asNode(firstValue(node, "unlocking_technologies")) || { items: [] }), loc),
        institution: institutionKey ? {
          key: institutionKey,
          name_zh: institutions.get(institutionKey)?.name_zh || locCleanName(loc, institutionKey),
        } : null,
        institution_modifiers: institutionModifiers,
        enactment_effects: lawEnactmentEffects(node, loc),
        amendments: [],
        parent: firstScalar(node, "parent"),
        disallowing_laws: nodeItems(asNode(firstValue(node, "disallowing_laws")) || { items: [] }),
        can_enact: conditionSummaryObject(firstValue(node, "can_enact"), loc),
        is_visible: conditionSummaryObject(firstValue(node, "is_visible"), loc),
        source_file: normalizePath(file),
      });
    }
  }
  return rows;
}

const technologyCategoryZh = {
  production: "生产",
  military: "军事",
  society: "社会",
};

const technologyEraLabels = {
  era_1: "时代 I",
  era_2: "时代 II",
  era_3: "时代 III",
  era_4: "时代 IV",
  era_5: "时代 V",
};

function loadTechnologyEras(dir) {
  const eras = new Map();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!Object.hasOwn(technologyEraLabels, key)) continue;
      const node = asNode(assignment.value);
      const cost = toNumberOrNull(firstScalar(node, "technology_cost"));
      if (cost === null) throw new Error(`科技时代缺少研究成本：${key}`);
      eras.set(key, { key, label_zh: technologyEraLabels[key], cost });
    }
  }
  return [...eras.values()].sort((left, right) => left.key.localeCompare(right.key, "en"));
}

function loadAchievements(definitionDirs, groupFiles, iconDirs, loc, locEn) {
  const groups = loadAchievementGroups(groupFiles, loc);
  const groupByAchievementKey = new Map();
  for (const group of groups) {
    for (const [groupOrder, key] of group.achievement_keys.entries()) {
      if (groupByAchievementKey.has(key)) {
        throw new Error(`achievement appears in multiple groups: ${key}`);
      }
      groupByAchievementKey.set(key, {
        group_key: group.key,
        group_name_zh: group.name_zh,
        group_order: groupOrder,
      });
    }
  }

  const achievementsByKey = new Map();
  for (const file of listFiles(definitionDirs)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      const group = groupByAchievementKey.get(key);
      if (!group) continue;
      if (achievementsByKey.has(key)) {
        throw new Error(`achievement definition appears more than once: ${key}`);
      }
      const node = asNode(assignment.value);
      const possible = node && firstValue(node, "possible");
      const happened = node && firstValue(node, "happened");
      const nameKey = `ACHIEVEMENT_${key}`;
      const descriptionKey = `ACHIEVEMENT_DESC_${key}`;
      if (!node || (possible !== undefined && !asNode(possible)) || !asNode(happened)) {
        throw new Error(`achievement script is incomplete: ${key}`);
      }
      if (!loc.has(nameKey) || !loc.has(descriptionKey)) {
        throw new Error(`achievement Chinese localization is missing: ${key}`);
      }
      if (!locEn.has(nameKey)) {
        throw new Error(`achievement English localization is missing: ${key}`);
      }
      achievementsByKey.set(key, {
        id: `achievement:${key}`,
        key,
        name_zh: locCleanName(loc, nameKey),
        name_en: locCleanName(locEn, nameKey),
        description_zh: locCleanName(loc, descriptionKey),
        ...group,
        details: achievementTooltipDetails(happened, loc),
        script: {
          possible: possible === undefined ? null : stringifyScriptValue(possible),
          happened: stringifyScriptValue(happened),
        },
        icon: {
          achieved: achievementIconPath(iconDirs, `${key}.jpg`, key),
          not_achieved: achievementIconPath(iconDirs, `${key}_notachieved.jpg`, key),
        },
        source_file: normalizePath(file),
      });
    }
  }
  if (achievementsByKey.size !== groupByAchievementKey.size) {
    const missing = [...groupByAchievementKey.keys()].filter((key) => !achievementsByKey.has(key));
    throw new Error(`achievement definitions are missing: ${missing.join(", ")}`);
  }
  return [...achievementsByKey.values()].sort((left, right) => (
    left.group_key.localeCompare(right.group_key, "en") || left.group_order - right.group_order
  ));
}

function loadEconomyData({
  buildingDirs,
  buildingGroupDirs,
  productionMethodGroupDirs,
  productionMethodDirs,
  goodsDirs,
  prestigeGoodsDirs,
  stateRegionRows,
  cultures,
  religions,
  companies,
  popNeeds,
  buyPackages,
  loc,
}) {
  const buildingGroups = loadBuildingGroups(buildingGroupDirs, loc);
  const productionMethodGroups = loadProductionMethodGroups(productionMethodGroupDirs, loc);
  const referencedProductionMethodKeys = new Set(productionMethodGroups.flatMap((group) => group.production_method_keys));
  const productionMethods = loadProductionMethods(productionMethodDirs, loc, referencedProductionMethodKeys);
  const goods = loadGoods(goodsDirs, loc);
  const prestigeGoods = loadPrestigeGoods(prestigeGoodsDirs, loc);
  const resourceBuildingKinds = new Map();
  for (const stateRegion of stateRegionRows) {
    for (const resource of stateRegion.arable_resources || []) resourceBuildingKinds.set(resource?.key, "arable");
    for (const resource of [...(stateRegion.capped_resources || []), ...(stateRegion.discoverable_resources || [])]) {
      if (resource?.key && !resourceBuildingKinds.has(resource.key)) resourceBuildingKinds.set(resource.key, "resource");
    }
  }
  const { buildings, excludedGraphicalBuildings } = loadBuildings(buildingDirs, buildingGroups, resourceBuildingKinds, loc);
  const buildingByKey = new Map(buildings.map((building) => [building.key, building]));
  const productionMethodByKey = new Map(productionMethods.map((method) => [method.key, method]));

  for (const group of productionMethodGroups) {
    const missingKeys = group.production_method_keys.filter((key) => !productionMethodByKey.has(key));
    if (missingKeys.length) {
      throw new Error(`production method group ${group.key} references missing methods: ${missingKeys.join(", ")}`);
    }
  }
  for (const building of buildings) {
    building.production_method_group_keys = building.production_method_group_keys
      .filter((key) => productionMethodGroups.some((group) => group.key === key));
    building.combination_count = building.production_method_group_keys.reduce((total, key) => {
      const count = productionMethodGroups.find((group) => group.key === key)?.production_method_keys.length || 0;
      return total * count;
    }, 1);
  }

  const producersByGoodKey = new Map(goods.map((good) => [good.key, new Set()]));
  const consumersByGoodKey = new Map(goods.map((good) => [good.key, new Set()]));
  for (const building of buildings) {
    const methodKeys = building.production_method_group_keys.flatMap((groupKey) => (
      productionMethodGroups.find((group) => group.key === groupKey)?.production_method_keys || []
    ));
    for (const methodKey of methodKeys) {
      for (const effect of productionMethodByKey.get(methodKey)?.effects || []) {
        const outputMatch = effect.key.match(/^goods_output_([a-z0-9_]+)_add$/);
        const inputMatch = effect.key.match(/^goods_input_([a-z0-9_]+)_add$/);
        if (outputMatch && effect.value > 0 && producersByGoodKey.has(outputMatch[1])) producersByGoodKey.get(outputMatch[1]).add(building.key);
        if (inputMatch && effect.value > 0 && consumersByGoodKey.has(inputMatch[1])) consumersByGoodKey.get(inputMatch[1]).add(building.key);
      }
    }
  }
  const buildingRefs = (keys) => [...keys]
    .map((key) => buildingByKey.get(key))
    .filter(Boolean)
    .sort((left, right) => economyDisplayName(left).localeCompare(economyDisplayName(right), "zh-Hans-CN") || left.key.localeCompare(right.key, "en"))
    .map((building) => ({
      key: building.key,
      name_zh: economyDisplayName(building),
      icon_path: building.icon.site_path,
    }));
  const prestigeCompaniesByKey = new Map(prestigeGoods.map((item) => [item.key, []]));
  for (const company of companies) {
    for (const prestigeGood of company.possible_prestige_goods || []) {
      if (!prestigeCompaniesByKey.has(prestigeGood.key)) throw new Error(`company ${company.key} references missing prestige good: ${prestigeGood.key}`);
      prestigeCompaniesByKey.get(prestigeGood.key).push({
        key: company.key,
        name_zh: company.name_zh,
        icon: company.icon,
      });
    }
  }
  const prestigeByBaseGood = new Map();
  for (const prestigeGood of prestigeGoods) {
    prestigeGood.companies = prestigeCompaniesByKey.get(prestigeGood.key).sort(sortByNameZh);
    if (!prestigeByBaseGood.has(prestigeGood.base_good_key)) prestigeByBaseGood.set(prestigeGood.base_good_key, []);
    prestigeByBaseGood.get(prestigeGood.base_good_key).push(prestigeGood.key);
  }
  for (const good of goods) {
    good.prestige_good_keys = (prestigeByBaseGood.get(good.key) || []).sort();
    good.producing_buildings = buildingRefs(producersByGoodKey.get(good.key) || []);
    good.consuming_buildings = buildingRefs(consumersByGoodKey.get(good.key) || []);
    good.pop_needs = [...popNeeds.values()].flatMap((need) => need.entries
      .filter((entry) => entry.goods_key === good.key)
      .map((entry) => ({
        key: need.key,
        name_zh: need.name_zh,
        is_default: need.default_good_key === good.key,
        weight: entry.weight,
        max_supply_share: entry.max_supply_share,
        min_supply_share: entry.min_supply_share,
        obsession_demand_min: need.obsession_demand_min,
        obsession_demand_mult: need.obsession_demand_mult,
        prestige_goods_demand_increase: need.prestige_goods_demand_increase,
        wealth_levels: [...(buyPackages.levelsByNeedKey.get(need.key) || [])].sort((left, right) => left - right),
      })))
      .sort(sortByNameZh);
    good.obsessed_cultures = [...cultures.values()]
      .filter((culture) => culture.obsessions.includes(good.key))
      .map((culture) => ({ key: culture.key, name_zh: locCleanName(loc, culture.key) }))
      .sort(sortByNameZh);
    good.starting_obsessed_cultures = [...cultures.values()]
      .filter((culture) => culture.starting_obsessions.some((entry) => entry.good_key === good.key))
      .map((culture) => ({
        key: culture.key,
        name_zh: locCleanName(loc, culture.key),
        sources: culture.starting_obsessions
          .find((entry) => entry.good_key === good.key)
          ?.sources || [],
      }))
      .sort(sortByNameZh);
    good.taboo_cultures = [...cultures.values()]
      .filter((culture) => culture.taboos.includes(good.key))
      .map((culture) => ({ key: culture.key, name_zh: locCleanName(loc, culture.key) }))
      .sort(sortByNameZh);
    good.taboo_religions = [...religions.values()]
      .filter((religion) => religion.taboos.includes(good.key))
      .map((religion) => ({ key: religion.key, name_zh: religion.name_zh }))
      .sort(sortByNameZh);
  }

  return {
    buildings,
    buildingGroups,
    productionMethodGroups,
    productionMethods,
    goods,
    prestigeGoods,
    excludedGraphicalBuildings,
  };
}

function loadBuildingGroups(dirs, loc) {
  const groupMap = new Map();
  let order = 0;
  const definitions = loadPatchedDefinitions(
    dirs,
    (key, node) => Boolean(node && key.startsWith("bg_")),
  );
  for (const record of definitions.values()) {
    const { key, node } = record;
    groupMap.set(key, {
      key,
      name_zh: locCleanName(loc, key),
      parent_group_key: firstScalar(node, "parent_group"),
      category_key: firstScalar(node, "category"),
      order: order += 1,
      source_file: record.source_file,
      source_files: record.source_files,
      patch_directives: record.patch_directives,
    });
  }
  for (const group of groupMap.values()) {
    let categoryKey = group.category_key;
    let parentKey = group.parent_group_key;
    const seen = new Set([group.key]);
    while (!categoryKey && parentKey && !seen.has(parentKey)) {
      seen.add(parentKey);
      const parent = groupMap.get(parentKey);
      categoryKey = parent?.category_key || "";
      parentKey = parent?.parent_group_key || "";
    }
    group.category_key = categoryKey || "other";
    group.category_name_zh = economyGroupCategoryName(group.category_key);
    group.category_name_en = economyGroupCategoryNameEn(group.category_key);
  }
  return [...groupMap.values()].sort((left, right) => left.order - right.order);
}

function loadProductionMethodGroups(dirs, loc) {
  const groups = new Map();
  const definitions = loadPatchedDefinitions(
    dirs,
    (key, node) => Boolean(node && key.startsWith("pmg_")),
  );
  for (const record of definitions.values()) {
    const { key, node } = record;
    const texture = firstScalar(node, "texture");
    groups.set(key, {
      key,
      name_zh: locCleanName(loc, key),
      icon: texture ? economyIcon(texture, "production-methods", key, "production method group") : null,
      production_method_keys: nodeItems(asNode(firstValue(node, "production_methods")) || { items: [] }).map(scriptEntryKey).filter(Boolean),
      source_file: record.source_file,
      source_files: record.source_files,
      patch_directives: record.patch_directives,
    });
  }
  return [...groups.values()].sort((left, right) => left.key.localeCompare(right.key, "en"));
}

function loadProductionMethods(dirs, loc, referencedKeys = new Set()) {
  const methods = new Map();
  const definitions = loadPatchedDefinitions(
    dirs,
    (key, node) => Boolean(node && (key.startsWith("pm_") || referencedKeys.has(key))),
  );
  for (const record of definitions.values()) {
    const { key, node } = record;
    const texture = firstScalar(node, "texture");
    methods.set(key, {
      key,
      name_zh: locCleanName(loc, key),
      description_zh: loc.has(`${key}_desc`) ? locCleanName(loc, `${key}_desc`) : "",
      icon: texture ? economyIcon(texture, "production-methods", key, "production method") : null,
      unlocking_technologies: referenceList(asNode(firstValue(node, "unlocking_technologies")), loc, "technology"),
      availability_conditions: productionMethodAvailabilityConditions(node, loc),
      effects: productionMethodEffects(node, loc),
      source_file: record.source_file,
      source_files: record.source_files,
      patch_directives: record.patch_directives,
    });
  }
  return [...methods.values()].sort((left, right) => left.key.localeCompare(right.key, "en"));
}

function loadGoods(dirs, loc) {
  const goods = new Map();
  const definitions = loadPatchedDefinitions(dirs, (key, node) => {
    if (!node || key.startsWith("goods_")) return false;
    return firstScalar(node, "texture").includes("goods_icons/");
  });
  for (const record of definitions.values()) {
    const { key, node } = record;
    const texture = firstScalar(node, "texture");
    goods.set(key, {
      key,
      name_zh: locCleanName(loc, key),
      description_zh: loc.has(`${key}_desc`) ? locCleanName(loc, `${key}_desc`) : "",
      category: firstScalar(node, "category") || "other",
      price: toNumberOrNull(firstScalar(node, "cost")),
      tradeable: firstScalar(node, "tradeable") !== "no",
      is_local: boolFromYesNo(firstScalar(node, "local")),
      fixed_price: boolFromYesNo(firstScalar(node, "fixed_price")),
      prestige_factor: toNumberOrNull(firstScalar(node, "prestige_factor")) ?? 0,
      traded_quantity: toNumberOrNull(firstScalar(node, "traded_quantity")) ?? 10,
      convoy_cost_multiplier: toNumberOrNull(firstScalar(node, "convoy_cost_multiplier")) ?? 1,
      obsession_chance: toNumberOrNull(firstScalar(node, "obsession_chance")) ?? 0,
      consumption_tax_cost: toNumberOrNull(firstScalar(node, "consumption_tax_cost")),
      pop_consumption_can_add_infrastructure: boolFromYesNo(firstScalar(node, "pop_consumption_can_add_infrastructure")),
      icon: economyIcon(texture, "goods", key, "good"),
      prestige_good_keys: [],
      producing_buildings: [],
      source_file: record.source_file,
      source_files: record.source_files,
      patch_directives: record.patch_directives,
    });
  }
  return [...goods.values()].sort((left, right) => left.key.localeCompare(right.key, "en"));
}

function loadPrestigeGoods(dirs, loc) {
  const goods = new Map();
  const definitions = loadPatchedDefinitions(
    dirs,
    (key, node) => Boolean(node && key.startsWith("prestige_good_")),
  );
  for (const record of definitions.values()) {
    const { key, node } = record;
    goods.set(key, {
      key,
      name_zh: locCleanName(loc, key),
      description_zh: loc.has(`${key}_desc`) ? locCleanName(loc, `${key}_desc`) : "",
      base_good_key: firstScalar(node, "base_good"),
      icon: economyIcon(firstScalar(node, "texture"), "prestige-goods", key, "prestige good"),
      source_file: record.source_file,
      source_files: record.source_files,
      patch_directives: record.patch_directives,
    });
  }
  return [...goods.values()].sort((left, right) => left.key.localeCompare(right.key, "en"));
}

function loadBuildings(dirs, buildingGroups, resourceBuildingKinds, loc) {
  const groupByKey = new Map(buildingGroups.map((group) => [group.key, group]));
  const buildings = [];
  const excludedGraphicalBuildings = [];
  const definitions = loadPatchedDefinitions(
    dirs,
    (key, node) => Boolean(node && key.startsWith("building_")),
  );
  for (const record of definitions.values()) {
    const { key, node } = record;
    const buildingGroupKey = firstScalar(node, "building_group");
    const iconSource = firstScalar(node, "icon");
    if (buildingGroupKey === "bg_monuments_hidden" && !iconSource) {
      excludedGraphicalBuildings.push({
        key,
        building_group: buildingGroupKey,
        source_file: record.source_file,
        source_files: record.source_files,
        patch_directives: record.patch_directives,
        reason: "missing_icon",
      });
      continue;
    }
    if (!iconSource) throw new Error(`building icon is missing: ${key}`);
    const buildingGroup = groupByKey.get(buildingGroupKey);
    if (!buildingGroup) throw new Error(`building group is missing: ${key} -> ${buildingGroupKey}`);
    const boardGroup = economyBoardGroup(buildingGroupKey, key);
    const rawName = locCleanName(loc, key);
    const fallbackName = key === "building_machu_picchu" ? "马丘比丘" : "";
    const displayName = rawName.includes("dummy building") ? "" : rawName;
    buildings.push({
      key,
      aliases: nodeItems(asNode(firstValue(node, "aliases")) || { items: [] })
        .map(scriptEntryKey)
        .filter(Boolean),
      name_zh: displayName,
      name_fallback_zh: fallbackName,
      description_zh: loc.has(`${key}_desc`) ? locCleanName(loc, `${key}_desc`) : "",
      icon: economyIcon(iconSource, "buildings", key, "building"),
      building_group: {
        key: buildingGroup.key,
        name_zh: buildingGroup.name_zh,
        category_key: buildingGroup.category_key,
        category_name_zh: buildingGroup.category_name_zh,
        order: buildingGroup.order,
      },
      board_group: boardGroup,
      city_type: firstScalar(node, "city_type"),
      required_construction: firstScalar(node, "required_construction"),
      unlocking_technologies: referenceList(asNode(firstValue(node, "unlocking_technologies")), loc, "technology"),
      resource_map_available: resourceBuildingKinds.has(key),
      resource_map_kind: resourceBuildingKinds.get(key) || "",
      production_method_group_keys: nodeItems(asNode(firstValue(node, "production_method_groups")) || { items: [] }).map(scriptEntryKey).filter(Boolean),
      combination_count: 0,
      source_file: record.source_file,
      source_files: record.source_files,
      patch_directives: record.patch_directives,
    });
  }
  return {
    buildings: buildings.sort((left, right) => economyDisplayName(left).localeCompare(economyDisplayName(right), "zh-Hans-CN")),
    excludedGraphicalBuildings: excludedGraphicalBuildings.sort((left, right) => left.key.localeCompare(right.key, "en")),
  };
}

function economyBoardGroup(buildingGroupKey, buildingKey) {
  const definitions = [
    ["agriculture", "农业", "Agriculture", [
      ["staple_crops", ["bg_staple_crops"]],
      ["ranching", ["bg_ranching"]],
      ["vineyard", ["bg_agriculture"]],
      ["plantations", ["bg_plantations"]],
      ["subsistence", ["bg_subsistence_agriculture", "bg_subsistence_ranching"]],
    ]],
    ["resources", "资源", "Resources", [
      ["mining", ["bg_mining"]],
      ["gold_fields", ["bg_gold_fields"]],
      ["logging", ["bg_logging"]],
      ["rubber", ["bg_rubber"]],
      ["oil", ["bg_oil_extraction"]],
      ["fishing", ["bg_fishing"]],
      ["whaling", ["bg_whaling"]],
    ]],
    ["industry", "工业", "Industrial", [
      ["light_industry", ["bg_light_industry", "bg_ship_construction"]],
      ["heavy_industry", ["bg_heavy_industry"]],
      ["military_industry", ["bg_military_industry"]],
    ]],
    ["military", "军事", "Military", [
      ["army", ["bg_army"]],
      ["conscription", ["bg_conscription"]],
      ["logistics", ["bg_army_logistics_center", "bg_naval_logistics_center"]],
      ["naval", ["bg_naval_administration", "bg_naval_fortification"]],
    ]],
    ["infrastructure", "基建", "Infrastructure", [
      ["construction", ["bg_construction"]],
      ["transport", ["bg_private_infrastructure", "bg_canals"]],
      ["power", ["bg_power"]],
      ["urban", ["bg_service", "bg_trade"]],
      ["government", ["bg_bureaucracy", "bg_technology", "bg_arts", "bg_skyscraper"]],
    ]],
    ["ownership", "所有权建筑", "Ownership Buildings", [
      ["ownership", ["bg_manor_houses", "bg_financial_districts", "bg_company_headquarter", "bg_company_regional_headquarter"]],
    ]],
    ["wonders", "奇观", "Monuments", [
      ["wonders", ["bg_monuments", "bg_monuments_hidden"]],
    ]],
  ];
  for (let groupIndex = 0; groupIndex < definitions.length; groupIndex += 1) {
    const [key, name_zh, name_en, clusters] = definitions[groupIndex];
    for (let clusterIndex = 0; clusterIndex < clusters.length; clusterIndex += 1) {
      const [cluster_key, sourceGroups] = clusters[clusterIndex];
      if (sourceGroups.includes(buildingGroupKey)) {
        return { key, name_zh, name_en, order: groupIndex + 1, cluster_key, cluster_order: clusterIndex + 1, item_order: economyBoardItemOrder(cluster_key, buildingKey) };
      }
    }
  }
  throw new Error(`building board group is missing: ${buildingKey} -> ${buildingGroupKey}`);
}

function economyBoardItemOrder(clusterKey, buildingKey) {
  const orders = {
    staple_crops: ["building_rye_farm", "building_rice_farm", "building_wheat_farm", "building_maize_farm", "building_millet_farm"],
    ranching: ["building_livestock_ranch"],
    vineyard: ["building_vineyard"],
    plantations: ["building_tea_plantation", "building_coffee_plantation", "building_cotton_plantation", "building_dye_plantation", "building_silk_plantation", "building_sugar_plantation", "building_banana_plantation", "building_opium_plantation", "building_tobacco_plantation"],
    subsistence: ["building_subsistence_rice_farm", "building_subsistence_orchard", "building_subsistence_farm", "building_subsistence_fishing_village", "building_subsistence_pasture"],
    mining: ["building_gold_mine", "building_sulfur_mine", "building_coal_mine", "building_lead_mine", "building_iron_mine"],
    gold_fields: ["building_gold_field"],
    logging: ["building_logging_camp"],
    rubber: ["building_rubber_plantation"],
    oil: ["building_oil_rig"],
    fishing: ["building_fishing_wharf"],
    whaling: ["building_whaling_station"],
    light_industry: ["building_glassworks", "building_textile_mill", "building_tooling_workshop", "building_furniture_manufactory", "building_food_industry", "building_paper_mill", "building_shipyard"],
    heavy_industry: ["building_electrics_industry", "building_motor_industry", "building_chemical_plant", "building_synthetics_plant", "building_steel_mill", "building_automotive_industry", "building_explosives_factory"],
    military_industry: ["building_arms_industry", "building_munition_plant", "building_artillery_foundry"],
    army: ["building_barrack"],
    conscription: ["building_conscription_center"],
    logistics: ["building_army_logistics_center", "building_naval_logistics_center"],
    naval: ["building_naval_administration", "building_naval_fortification"],
    construction: ["building_construction_sector"],
    transport: ["building_port", "building_railway", "building_panama_canal", "building_kiel_canal", "building_suez_canal"],
    power: ["building_power_plant"],
    urban: ["building_urban_center", "building_trade_center"],
    government: ["building_government_administration", "building_university", "building_art_academy", "building_skyscraper"],
    ownership: ["building_manor_house", "building_financial_district", "building_company_headquarter", "building_company_regional_headquarter"],
    wonders: ["building_estacion_de_madrid_atocha", "building_eiffel_tower", "building_white_house", "building_big_ben", "building_vatican_city", "building_power_bloc_statue", "building_gran_teatro_de_la_habana", "building_kaiserforum_1", "building_kaiserforum_2", "building_kaiserforum_3", "building_kaiserforum_4", "building_mosque_of_djenne", "building_cristo_redentor", "building_manila_cathedral_original", "building_manila_cathedral_monument", "building_manila_cathedral_ruins", "building_pena_convent", "building_pena_palace", "building_sagrada_familia_cathedral_1", "building_sagrada_familia_cathedral_2", "building_sagrada_familia_cathedral_3", "building_hagia_sophia", "building_saint_basils_cathedral", "building_taj_mahal", "building_victoria_terminus", "building_angkor_wat", "building_forbidden_city", "building_statue_of_liberty", "building_machu_picchu"],
  };
  const order = orders[clusterKey]?.indexOf(buildingKey) ?? -1;
  return order >= 0 ? order + 1 : 100;
}

function productionMethodAvailabilityConditions(node, loc) {
  const fields = [
    ["unlocking_technologies", "technology"],
    ["unlocking_laws", "required_law"],
    ["disallowing_laws", "disallowed_law"],
    ["required_input_goods", "good"],
    ["replacement_if_valid", "script"],
  ];
  return fields.flatMap(([field, kind]) => {
    const value = firstValue(node, field);
    if (!value) return [];
    if (kind === "script") return [{ kind, summary_zh: summarizeScriptCondition(value, loc), raw: stringifyScriptValue(value), references: [] }];
    const keys = asNode(value) ? nodeItems(asNode(value)).map(stripPrefix) : [stripPrefix(scalarFromValue(value))];
    return keys.filter(Boolean).map((key) => ({
      kind,
      summary_zh: locCleanName(loc, key),
      raw: key,
      references: [{ key, name_zh: locCleanName(loc, key) }],
    }));
  });
}

function productionMethodEffects(node, loc) {
  return ["building_modifiers", "state_modifiers", "country_modifiers"].flatMap((scope) => (
    collectProductionMethodEffects(firstValue(node, scope), scope.replace("_modifiers", ""), "", null, loc)
  ));
}

function collectProductionMethodEffects(value, scope, scaling, conditionValue, loc) {
  const node = asNode(value);
  if (!node) return [];
  const effects = [];
  for (const assignment of node.assignments) {
    if (["unscaled", "workforce_scaled", "level_scaled"].includes(assignment.key)) {
      effects.push(...collectProductionMethodEffects(assignment.value, scope, assignment.key, conditionValue, loc));
      continue;
    }
    if (assignment.key === "if" || assignment.key === "else_if") {
      const branch = asNode(assignment.value);
      effects.push(...collectProductionMethodEffects(assignment.value, scope, scaling, branch ? firstValue(branch, "limit") : conditionValue, loc));
      continue;
    }
    const numeric = toNumberOrNull(scalarFromValue(assignment.value));
    if (numeric === null) continue;
    effects.push({
      scope,
      scaling,
      key: assignment.key,
      name_zh: cleanLocalizationText(locName(loc, assignment.key), loc),
      value: numeric,
      value_zh: formatModifierValue(assignment.key, numeric, String(numeric)),
      condition: conditionValue ? conditionSummaryObject(conditionValue, loc) : null,
    });
  }
  return effects;
}

function economyIcon(source, category, key, label) {
  if (!source || !/\.(?:dds|png)$/i.test(source)) throw new Error(`${label} icon is missing: ${key}`);
  return { source, site_path: `assets/${category}/${key}.webp` };
}

function referenceList(node, loc, idPrefix) {
  return nodeItems(node || { items: [] }).map(stripPrefix).filter(Boolean).map((key) => ({
    id: `${idPrefix}:${key}`,
    key,
    name_zh: locCleanName(loc, key),
  }));
}

function economyGroupCategoryName(key) {
  return ({ rural: "乡村", urban: "城市", development: "发展", military: "军事", other: "其他" })[key] || key;
}

function economyGroupCategoryNameEn(key) {
  return ({ rural: "Rural", urban: "Urban", development: "Development", military: "Military", other: "Other" })[key] || key;
}

function economyDisplayName(item) {
  return item?.name_zh || item?.name_fallback_zh || item?.key || "";
}

function attachAchievementCountryReferences(achievements, countryRows) {
  const countryNameByTag = new Map(countryRows.map((country) => [country.tag, country.name_zh]));
  for (const achievement of achievements) {
    const tags = [...new Set(`${achievement.script.possible || ""}\n${achievement.script.happened}`.match(/\bc:([A-Z]{3})\b/g) || [])]
      .map((value) => value.slice(2))
      .sort();
    achievement.related_countries = tags.map((tag) => {
      const name_zh = countryNameByTag.get(tag);
      if (!name_zh) throw new Error(`achievement country reference has no country record: ${achievement.key} -> ${tag}`);
      return { tag, name_zh };
    });
  }
}

function loadAchievementGroups(groupFiles, loc) {
  const groups = [];
  const groupKeys = new Set();
  for (const file of listFiles(groupFiles)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      if (assignment.key !== "group") continue;
      const node = asNode(assignment.value);
      const key = node && firstScalar(node, "name");
      const order = node && asNode(firstValue(node, "order"));
      const achievementKeys = order ? nodeItems(order).map(scriptEntryKey).filter(Boolean) : [];
      const nameKey = `ACHIEVEMENT_GROUP_${key}`;
      if (!key || groupKeys.has(key) || achievementKeys.length === 0 || !loc.has(nameKey)) {
        throw new Error(`achievement group is incomplete: ${key || normalizePath(file)}`);
      }
      groupKeys.add(key);
      groups.push({
        key,
        name_zh: locCleanName(loc, nameKey),
        achievement_keys: achievementKeys,
      });
    }
  }
  return groups;
}

function achievementTooltipDetails(value, loc) {
  const details = [];
  const seen = new Set();
  const visit = (current) => {
    const node = asNode(current);
    if (!node) return;
    for (const item of node.items) visit(item);
    for (const assignment of node.assignments) {
      if (assignment.key === "custom_tooltip") {
        const tooltip = asNode(assignment.value);
        const key = tooltip && firstScalar(tooltip, "text");
        if (!key || !loc.has(key)) {
          throw new Error(`achievement tooltip localization is missing: ${key || "custom_tooltip"}`);
        }
        if (!seen.has(key)) {
          seen.add(key);
          details.push({ key, text_zh: achievementTooltipText(loc, key) });
        }
      }
      visit(assignment.value);
    }
  };
  visit(value);
  return details;
}

function achievementTooltipText(loc, key) {
  return locCleanName(loc, key)
    .replace(/\[Get(?:StateRegion|GeographicRegion|Culture|Religion)\('([^']+)'\)\.GetName\]/g, (_match, targetKey) => locCleanName(loc, targetKey))
    .replace(/\[THIS\.GetCountry\.GetName\]/g, "该国")
    .replace(/\[ROOT\.GetCountry\.GetName\]/g, "本国")
    .replace(/\[ROOT\.GetCountry\.GetAdjective\]/g, "本国")
    .replace(/!/g, "");
}

function achievementIconPath(iconDirs, filename, key) {
  const dirs = Array.isArray(iconDirs) ? iconDirs : [iconDirs];
  for (const dir of [...dirs].reverse()) {
    const file = path.join(dir, filename);
    if (fs.existsSync(file)) return normalizePath(path.relative(gameDir, file));
  }
  throw new Error(`achievement icon is missing: ${key}`);
}

function loadTechnologies(dir, technologyEras, loc) {
  const eraByKey = new Map(technologyEras.map((era) => [era.key, era]));
  const technologies = [];
  let sortOrder = 0;
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      const node = asNode(assignment.value);
      if (!node) continue;
      const era = stripPrefix(firstScalar(node, "era"));
      const category = stripPrefix(firstScalar(node, "category"));
      if (!eraByKey.has(era) || !Object.hasOwn(technologyCategoryZh, category)) continue;
      const prerequisites = nodeItems(asNode(firstValue(node, "unlocking_technologies")) || { items: [] })
        .map(stripPrefix)
        .filter(Boolean)
        .sort();
      const modifiers = allValues(node, "modifier")
        .map(asNode)
        .filter(Boolean)
        .flatMap((modifierNode) => modifierNode.assignments.map((item) => modifierRef(item.key, item.value, loc)));
      technologies.push({
        id: `technology:${key}`,
        key,
        name_zh: locCleanName(loc, key),
        desc_zh: loc.has(`${key}_desc`) ? cleanLocalizationText(locName(loc, `${key}_desc`), loc) : "",
        icon: stripQuotes(firstScalar(node, "texture")),
        category,
        category_zh: technologyCategoryZh[category],
        era,
        era_label_zh: eraByKey.get(era).label_zh,
        era_cost: eraByKey.get(era).cost,
        prerequisites,
        unlocks: [],
        modifiers,
        modifier_summary_zh: joinValues(modifiers.map((modifier) => modifier.summary_zh)),
        references: { laws: [], companies: [] },
        source_file: normalizePath(file),
        sort_order: sortOrder++,
      });
    }
  }
  return technologies;
}

function attachTechnologyReferences(technologies, { laws, companies }) {
  const byKey = new Map(technologies.map((technology) => [technology.key, technology]));
  for (const technology of technologies) {
    for (const key of technology.prerequisites) {
      const prerequisite = byKey.get(key);
      if (!prerequisite) throw new Error(`科技 ${technology.key} 引用了不存在的前置科技：${key}`);
      prerequisite.unlocks.push({ key: technology.key, name_zh: technology.name_zh });
    }
    technology.references = {
      laws: [...laws.values()]
        .filter((law) => law.unlocking_technologies.some((item) => item.key === technology.key))
        .map((law) => ({ key: law.key, name_zh: law.name_zh })),
      companies: companies
        .filter((company) => company.required_technologies.some((item) => item.key === technology.key))
        .map((company) => ({ key: company.key, name_zh: company.name_zh })),
    };
  }
  for (const technology of technologies) {
    technology.unlocks.sort((left, right) => left.name_zh.localeCompare(right.name_zh, "zh-Hans-CN"));
    technology.references.laws.sort((left, right) => left.name_zh.localeCompare(right.name_zh, "zh-Hans-CN"));
    technology.references.companies.sort((left, right) => left.name_zh.localeCompare(right.name_zh, "zh-Hans-CN"));
  }
}

function lawEnactmentEffects(node, loc) {
  const raw = ["on_activate", "on_enact"]
    .map((key) => firstValue(node, key))
    .filter(Boolean)
    .map((value) => stringifyScriptValue(value))
    .join("\n");
  const labels = [];
  if (/\bliberate_slaves\s*=\s*yes\b/.test(raw)) labels.push({ template: "enum.lawEnactmentEffect.liberateSlaves" });
  if (/\bliberate_slaves_in_incorporated_states\s*=\s*yes\b/.test(raw)) labels.push({ template: "enum.lawEnactmentEffect.liberateSlavesInIncorporatedStates" });
  return labels;
}

function characterIdeologyRequirements(node, loc) {
  const result = {
    country: conditionSummaryObject(firstValue(node, "country_trigger"), loc),
    interest_group_leader: conditionSummaryObject(firstValue(node, "interest_group_leader_trigger"), loc),
    non_interest_group_leader: conditionSummaryObject(firstValue(node, "non_interest_group_leader_trigger"), loc),
  };
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value));
}

function conditionSummaryObject(value, loc) {
  if (!value) return null;
  const raw = stringifyScriptValue(value);
  return {
    summary_zh: summarizeScriptCondition(value, loc),
    raw,
    interest_groups: refObjects([...collectInterestGroupRefs(value)], loc, "interest_group"),
    laws: refObjects([...collectLawRefs(value)], loc, "law"),
    technologies: refsToObjects([...collectTechnologyRefs(value)], loc),
    journal_entries: refsToObjects([...collectJournalEntryRefs(value)], loc),
    traits: traitRefs([...collectCharacterTraitRefs(value)], loc),
    variables: [...collectVariableRefs(value)].sort(),
  };
}

function ideologyWeightSummary(value, loc) {
  const node = asNode(value);
  if (!node) return null;
  const entries = [];
  for (const assignment of node.assignments) {
    if (assignment.key === "value") {
      entries.push(weightEntryFromValue(assignment.value, "base", null, loc));
      continue;
    }
    if (assignment.key === "add" || assignment.key === "multiply") {
      entries.push(weightEntryFromEffect(assignment.key, assignment.value, null, loc));
      continue;
    }
    if (assignment.key === "if" || assignment.key === "else_if") {
      const branch = asNode(assignment.value);
      if (!branch) continue;
      const limit = firstValue(branch, "limit");
      for (const effect of branch.assignments) {
        if (effect.key !== "add" && effect.key !== "multiply") continue;
        entries.push(weightEntryFromEffect(effect.key, effect.value, limit, loc));
      }
    }
  }
  const cleanedEntries = entries.filter(Boolean);
  return cleanedEntries.length ? {
    raw: stringifyScriptValue(value),
    entries: cleanedEntries,
  } : null;
}

function weightEntryFromValue(value, kind, limit, loc) {
  const node = asNode(value);
  if (!node) {
    const numeric = toNumberOrNull(scalarFromValue(value));
    return numeric === null ? null : weightEntry(kind, numeric, "", limit, loc);
  }
  const addAssignment = node.assignments.find((assignment) => assignment.key === "add" || assignment.key === "multiply");
  if (addAssignment) {
    const nestedNode = asNode(addAssignment.value);
    const nestedValue = nestedNode ? firstScalar(nestedNode, "value") : scalarFromValue(addAssignment.value);
    return weightEntry(addAssignment.key, toNumberOrNull(nestedValue), firstScalar(nestedNode || node, "desc"), limit, loc);
  }
  return weightEntry(kind, toNumberOrNull(firstScalar(node, "value")), firstScalar(node, "desc"), limit, loc);
}

function weightEntryFromEffect(kind, value, limit, loc) {
  const node = asNode(value);
  if (!node) return weightEntry(kind, toNumberOrNull(scalarFromValue(value)), "", limit, loc);
  return weightEntry(kind, toNumberOrNull(firstScalar(node, "value")), firstScalar(node, "desc"), limit, loc);
}

function weightEntry(kind, value, desc, limit, loc) {
  if (value === null) return null;
  const condition = conditionSummaryObject(limit, loc);
  return {
    kind,
    value,
    desc: desc || "",
    condition_summary_zh: condition?.summary_zh || "",
    condition_raw: condition?.raw || "",
    interest_groups: condition?.interest_groups || [],
    laws: condition?.laws || [],
    technologies: condition?.technologies || [],
    journal_entries: condition?.journal_entries || [],
    traits: condition?.traits || [],
    variables: condition?.variables || [],
  };
}

function summarizeScriptCondition(value, loc) {
  if (!value) return "";
  const interestGroups = [...collectInterestGroupRefs(value)].sort();
  const laws = [...collectLawRefs(value)].sort();
  const technologies = [...collectTechnologyRefs(value)].sort();
  const journalEntries = [...collectJournalEntryRefs(value)].sort();
  const traits = [...collectCharacterTraitRefs(value)].sort();
  const variables = [...collectVariableRefs(value)].sort();
  const parts = [];
  if (interestGroups.length) parts.push(`利益集团：${interestGroups.map((key) => locName(loc, key)).join("、")}`);
  if (laws.length) parts.push(`法律：${laws.map((key) => locName(loc, key)).join("、")}`);
  if (technologies.length) parts.push(`科技：${technologies.map((key) => locName(loc, key)).join("、")}`);
  if (journalEntries.length) parts.push(`日志条目：${journalEntries.map((key) => locName(loc, key)).join("、")}`);
  if (traits.length) parts.push(`特质：${traits.map((key) => locName(loc, characterTraitLocKey(key))).join("、")}`);
  if (variables.length) parts.push(`变量：${variables.join("、")}`);
  return parts.length ? parts.join("；") : "脚本条件";
}

function refObjects(keys, loc, idPrefix) {
  return unique(keys || []).filter(Boolean).sort().map((key) => ({
    id: `${idPrefix}:${key}`,
    key,
    name_zh: locName(loc, key),
  }));
}

function traitRefs(keys, loc) {
  return unique(keys || []).filter(Boolean).sort().map((key) => ({
    id: `trait:${key}`,
    key,
    name_zh: locName(loc, characterTraitLocKey(key)),
  }));
}

function characterTraitLocKey(key) {
  return String(key || "").replace(/^trait_/, "");
}

function loadInterestGroups(dir, loc, interestGroupTraits, ideologies) {
  const rows = new Map();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!key.startsWith("ig_")) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      const ideologyKeys = nodeItems(asNode(firstValue(node, "ideologies")) || { items: [] }).map(stripPrefix).filter(Boolean);
      const characterIdeologyKeys = nodeItems(asNode(firstValue(node, "character_ideologies")) || { items: [] }).map(stripPrefix).filter(Boolean);
      const baseTraitKeys = nodeItems(asNode(firstValue(node, "traits")) || { items: [] }).map(stripPrefix).filter(Boolean);
      const onEnable = firstValue(node, "on_enable");
      rows.set(key, {
        id: `interest_group:${key}`,
        key,
        name_zh: locCleanName(loc, key),
        desc_zh: loc.has(`${key}_desc`) ? cleanLocalizationText(locName(loc, `${key}_desc`), loc) : "",
        color: parseColorValue(firstValue(node, "color")),
        texture: stripQuotes(firstScalar(node, "texture")),
        layer: stripQuotes(firstScalar(node, "layer")),
        index: toNumberOrNull(firstScalar(node, "index")),
        ideologies: ideologyKeys.map((key) => ideologyRef(key, ideologies)),
        character_ideologies: characterIdeologyKeys.map((key) => ideologyRef(key, ideologies)),
        base_traits: baseTraitKeys.map((key) => interestGroupTraitRef(key, interestGroupTraits)),
        potential_flavors: [],
        pop_attraction: interestGroupPopAttraction(firstValue(node, "pop_weight"), loc, key),
        flavor_rule_count: countInterestGroupFlavorRules(onEnable),
        source_file: normalizePath(file),
        _on_enable: onEnable,
        _base_trait_keys: baseTraitKeys,
        _base_ideology_keys: ideologyKeys,
        _character_ideology_keys: characterIdeologyKeys,
      });
    }
  }
  return [...rows.values()].sort((a, b) => (
    (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER)
    || a.key.localeCompare(b.key)
  ));
}

function interestGroupFlavorSourceDirs() {
  const commonDirs = contentPath("common");
  return [
    ...commonDirs,
    ...contentPath("events"),
    ...commonDirs.map((dir) => path.join(dir, "history", "countries")),
    ...commonDirs.map((dir) => path.join(dir, "journal_entries")),
    ...commonDirs.map((dir) => path.join(dir, "scripted_effects")),
    ...commonDirs.map((dir) => path.join(dir, "scripted_buttons")),
  ];
}

function attachInterestGroupPotentialFlavors(interestGroups, { sourceDirs, loc, interestGroupTraits }) {
  const groupsByKey = new Map((interestGroups || []).map((group) => [group.key, group]));
  const flavorsByGroup = new Map();
  for (const file of listFiles(sourceDirs)) {
    const source = readText(file);
    if (!source.includes("set_interest_group_name")) continue;
    const root = parseScript(source, file);
    collectPotentialInterestGroupFlavors(root, {
      groupKey: "",
      conditions: [],
      scopeTraitKeys: [],
      sourceFile: normalizePath(file),
      loc,
      interestGroupTraits,
      groupsByKey,
      flavorsByGroup,
    });
  }
  for (const group of interestGroups || []) {
    group.potential_flavors = [...(flavorsByGroup.get(group.key)?.values() || [])]
      .map((flavor) => ({
        ...flavor,
        traits: uniqueRefs([
          ...flavor.traits,
          ...interestGroupPotentialFlavorTraitOverrides(group.key, flavor.key)
            .filter((key) => interestGroupTraits.has(key))
            .map((key) => interestGroupTraitRef(key, interestGroupTraits)),
        ]),
        rules: [...flavor.rules.values()],
      }))
      .sort((left, right) => left.name_zh.localeCompare(right.name_zh) || left.key.localeCompare(right.key));
  }
}

function interestGroupPotentialFlavorTraitOverrides(groupKey, flavorKey) {
  const overrides = {
    "ig_devout:ig_taiping_god_worshippers": [
      "ig_trait_pious_fiction",
      "ig_trait_divine_right",
      "ig_trait_work_ethic",
    ],
    "ig_industrialists:ig_gosho": [
      "ig_trait_zaibatsu_withdrawal",
      "ig_trait_railway_bonds",
      "ig_trait_zaibatsu_cooperation",
    ],
    "ig_industrialists:ig_zaibatsu": [
      "ig_trait_zaibatsu_withdrawal",
      "ig_trait_railway_bonds",
      "ig_trait_zaibatsu_cooperation",
    ],
    "ig_petty_bourgeoisie:ig_chonin": [
      "ig_trait_xenophobia",
      "ig_trait_middle_managers",
      "ig_trait_treasury_bonds",
    ],
    "ig_landowners:ig_kazoku": [
      "ig_trait_kazoku_system",
      "ig_trait_taisei_hokan",
    ],
  };
  return overrides[`${groupKey}:${flavorKey}`] || [];
}

const interestGroupConditionVariantDefinitions = {
  ig_devout: [
    {
      key: "jewish",
      name_zh: "犹太教",
      condition: `{
  owner = {
    country_has_state_religion = rel:jewish
  }
}`,
      traits: ["ig_trait_traditsye", "ig_trait_yeshivot", "ig_trait_the_best_revenge"],
    },
    {
      key: "animist",
      name_zh: "泛灵论",
      condition: `{
  owner = {
    country_has_state_religion = rel:animist
  }
}`,
      traits: ["ig_trait_pious_fiction", "ig_trait_divine_right", "ig_trait_be_fruitful_and_multiply"],
    },
  ],
  ig_armed_forces: [
    {
      key: "latin_spanish",
      name_zh: "军队（拉美西语）",
      condition: `{\n  owner = {\n    any_primary_culture = {\n      has_discrimination_trait = language_hispanophone\n      has_discrimination_trait_group = heritage_group_european\n      NOT = { has_discrimination_trait = heritage_iberian }\n    }\n  }\n}`,
    traits: ["ig_trait_materiel_waste", "ig_trait_veteran_consultation", "ig_trait_el_buen_jefe"],
  },
  {
    key: "caudillo_cultures",
    name_zh: "军队（普拉塔/南安第斯/北安第斯/中美/墨西哥）",
    condition: `{\n  is_in_geographic_region = geographic_region_latin_america\n  OR = {\n    country_has_primary_culture = cu:platinean\n    country_has_primary_culture = cu:south_andean\n    country_has_primary_culture = cu:north_andean\n    country_has_primary_culture = cu:central_american\n    country_has_primary_culture = cu:mexican\n  }\n}`,
    added_ideologies: ["ideology_caudillismo"],
  },
  ],
  ig_landowners: [
    {
      key: "latin_spanish",
      name_zh: "地主（拉美西语）",
      condition: `{\n  any_primary_culture = {\n    has_discrimination_trait = language_hispanophone\n    has_discrimination_trait_group = heritage_group_european\n    NOT = { has_discrimination_trait = heritage_iberian }\n    NOT = { cu:caribeno = this }\n  }\n}`,
      added_ideologies: ["ideology_republican_paternalistic"],
      removed_ideologies: ["ideology_paternalistic"],
    },
    {
      key: "boer",
      name_zh: "地主（布尔）",
      condition: `{\n  country_has_primary_culture = cu:boer\n  NOT = {\n    NOT = { any_primary_culture = { cu:boer = this } }\n  }\n}`,
      added_ideologies: ["ideology_republican_paternalistic"],
      removed_ideologies: ["ideology_paternalistic"],
    },
    {
      key: "polish",
      name_zh: "地主（波兰）",
      condition: `{\n  country_has_primary_culture = cu:polish\n}`,
      added_ideologies: ["ideology_magnatial"],
      removed_ideologies: ["ideology_paternalistic"],
    },
  ],
  ig_intelligentsia: [{
    key: "constitutionalists",
    name_zh: "知识分子（立宪派）",
    condition: `{\n  OR = {\n    c:GBR ?= THIS\n    c:POR ?= THIS\n    c:SPA ?= THIS\n    c:AUS ?= THIS\n    any_primary_culture = {\n      has_discrimination_trait_group = heritage_group_south_asian\n    }\n  }\n}`,
    added_ideologies: ["ideology_constitutionalist"],
    removed_ideologies: ["ideology_republican"],
  }],
  ig_industrialists: [{
    key: "colonial",
    name_zh: "实业家（殖民）",
    condition: `{\n  owner = {\n    OR = {\n      c:DEI ?= this\n      c:ALK ?= this\n      c:HBC ?= this\n      is_country_type = company\n    }\n  }\n}`,
    added_ideologies: ["ideology_colonialist"],
    removed_ideologies: ["ideology_laissez_faire"],
  }],
  ig_petty_bourgeoisie: [{
    key: "mercantile",
    name_zh: "小市民（重商派）",
    condition: `{\n  owner = {\n    OR = {\n      has_law_or_variant = law_type:law_traditionalism\n      has_law_or_variant = law_type:law_isolationism\n    }\n  }\n}`,
    added_ideologies: ["ideology_mercantile"],
  }],
};

function attachInterestGroupConditionVariants(interestGroups, { loc, interestGroupTraits, ideologies }) {
  for (const group of interestGroups || []) {
    const variants = interestGroupConditionVariantDefinitions[group.key] || [];
    group.condition_variants = variants.map((variant) => ({
      id: `interest_group_condition_variant:${group.key}:${variant.key}`,
      key: variant.key,
      name_zh: variant.name_zh,
      condition_summary_zh: summarizeInterestGroupCondition(parseScript(variant.condition, `<condition:${group.key}:${variant.key}>`), {
        locName: (key) => locCleanName(loc, key),
      }).summary_zh,
      condition_raw: variant.condition,
      traits: (variant.traits || []).map((key) => interestGroupTraitRef(key, interestGroupTraits)),
      added_ideologies: (variant.added_ideologies || []).map((key) => ideologyRef(key, ideologies)),
      removed_ideologies: (variant.removed_ideologies || []).map((key) => ideologyRef(key, ideologies)),
    }));
  }
}

function collectPotentialInterestGroupFlavors(value, context) {
  const node = asNode(value);
  if (!node) return;
  const localConditions = [
    ...context.conditions,
    ...node.assignments
      .filter((assignment) => ["trigger", "is_shown", "possible"].includes(assignment.key))
      .map((assignment) => assignment.value),
  ];
  for (const assignment of node.assignments) {
    const scopedGroupKey = interestGroupScopeKey(assignment.key);
    if (scopedGroupKey) {
      const scopedNode = asNode(assignment.value);
      collectPotentialInterestGroupFlavors(assignment.value, {
        ...context,
        groupKey: scopedGroupKey,
        conditions: localConditions,
        scopeTraitKeys: directInterestGroupTraitKeys(scopedNode),
      });
      continue;
    }
    if (assignment.key === "set_interest_group_name" && context.groupKey && context.groupsByKey.has(context.groupKey)) {
      addPotentialInterestGroupFlavor(context, stripPrefix(scalarFromValue(assignment.value)));
      continue;
    }
    if (["trigger", "is_shown", "possible", "limit"].includes(assignment.key)) continue;
    if (["if", "else_if", "else"].includes(assignment.key)) {
      const branch = asNode(assignment.value);
      const limit = branch ? firstValue(branch, "limit") : null;
      collectPotentialInterestGroupFlavors(assignment.value, {
        ...context,
        conditions: limit ? [...localConditions, limit] : localConditions,
      });
      continue;
    }
    collectPotentialInterestGroupFlavors(assignment.value, {
      ...context,
      conditions: localConditions,
    });
  }
}

function interestGroupScopeKey(value) {
  const match = String(value || "").match(/^ig:(ig_[a-z0-9_]+)/i);
  return match ? match[1] : "";
}

function directInterestGroupTraitKeys(node) {
  if (!node) return [];
  return node.assignments
    .filter((assignment) => assignment.key === "set_ig_trait")
    .map((assignment) => stripPrefix(scalarFromValue(assignment.value)))
    .filter(Boolean);
}

function addPotentialInterestGroupFlavor(context, flavorKey) {
  if (!flavorKey || flavorKey === context.groupKey) return;
  const groupFlavors = context.flavorsByGroup.get(context.groupKey) || new Map();
  const flavor = groupFlavors.get(flavorKey) || {
    id: `interest_group_flavor:${context.groupKey}:${flavorKey}`,
    key: flavorKey,
    name_zh: locCleanName(context.loc, flavorKey),
    traits: [],
    rules: new Map(),
  };
  const condition = combineConditionSummaries(context.conditions.map((value) => summarizeInterestGroupCondition(value, {
    locName: (key) => locCleanName(context.loc, key),
  })));
  const rule = {
    condition_summary_zh: condition.summary_zh,
    condition_raw: condition.raw,
    source_file: context.sourceFile,
    names: [{ key: flavorKey, name_zh: locCleanName(context.loc, flavorKey) }],
    traits: context.scopeTraitKeys.map((key) => interestGroupTraitRef(key, context.interestGroupTraits)),
    added_ideologies: [],
    removed_ideologies: [],
  };
  for (const trait of rule.traits) flavor.traits.push(trait);
  flavor.rules.set(interestGroupRuleSignature(rule), rule);
  groupFlavors.set(flavorKey, flavor);
  context.flavorsByGroup.set(context.groupKey, groupFlavors);
}

function interestGroupRuleSignature(rule) {
  return [rule.condition_raw, rule.source_file, ...(rule.traits || []).map((trait) => trait.key)].join("|");
}

function interestGroupPopAttraction(value, loc, groupKey) {
  const node = asNode(value);
  if (!node) return [];
  const entries = [];
  collectInterestGroupPopAttractionScope(node, [], "", entries, loc);
  const seen = new Set();
  return entries.filter((entry) => {
    const signature = [
      entry.label_key,
      entry.value_raw,
      entry.condition_raw,
    ].join("|");
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  }).map((entry, index) => ({
    ...entry,
    id: `interest_group_pop_attraction:${groupKey}:${index}`,
  }));
}

function collectInterestGroupPopAttractionScope(node, conditions, inheritedLabel, entries, loc, isOtherwise = false) {
  for (const assignment of node.assignments || []) {
    if (assignment.key === "add") {
      collectInterestGroupPopAttractionAdd(assignment.value, conditions, inheritedLabel, entries, loc, isOtherwise);
      continue;
    }
    if (assignment.key !== "if" && assignment.key !== "else_if" && assignment.key !== "else") continue;
    const branch = asNode(assignment.value);
    if (!branch) continue;
    const limit = firstValue(branch, "limit");
    const nextConditions = limit ? [...conditions, limit] : conditions;
    collectInterestGroupPopAttractionScope(branch, nextConditions, inheritedLabel, entries, loc, isOtherwise || assignment.key === "else");
  }
}

function collectInterestGroupPopAttractionAdd(value, conditions, inheritedLabel, entries, loc, isOtherwise = false) {
  const node = asNode(value);
  if (!node) {
    const entry = interestGroupPopAttractionEntry(value, inheritedLabel, conditions, loc, null, isOtherwise);
    if (entry) entries.push(entry);
    return;
  }
  const labelKey = firstScalar(node, "desc") || inheritedLabel;
  collectInterestGroupPopAttractionValues(node, conditions, labelKey, entries, loc, isOtherwise);
}

function collectInterestGroupPopAttractionValues(node, conditions, labelKey, entries, loc, isOtherwise) {
  for (const assignment of node.assignments || []) {
    if (assignment.key === "value") {
      const entry = interestGroupPopAttractionEntry(assignment.value, labelKey, conditions, loc, node, isOtherwise);
      if (entry) entries.push(entry);
      continue;
    }
    if (assignment.key === "add") {
      collectInterestGroupPopAttractionAdd(assignment.value, conditions, labelKey, entries, loc, isOtherwise);
      continue;
    }
    if (assignment.key !== "if" && assignment.key !== "else_if" && assignment.key !== "else") continue;
    const branch = asNode(assignment.value);
    if (!branch) continue;
    const limit = firstValue(branch, "limit");
    const nextConditions = limit ? [...conditions, limit] : conditions;
    collectInterestGroupPopAttractionValues(branch, nextConditions, labelKey, entries, loc, isOtherwise || assignment.key === "else");
  }
}

function interestGroupPopAttractionEntry(value, labelKey, conditions, loc, parentNode = null, isOtherwise = false) {
  const valueText = stringifyScriptValue(value).trim();
  if (!valueText || !labelKey) return null;
  const multiplier = parentNode ? firstScalar(parentNode, "multiply") : "";
  const condition = interestGroupPopAttractionCondition(conditions, loc);
  return {
    label_key: labelKey,
    label_zh: locCleanName(loc, labelKey),
    value_raw: valueText,
    multiplier_raw: multiplier || "",
    is_otherwise: isOtherwise,
    condition_summary_zh: condition.summary_zh,
    condition_raw: condition.raw,
    pop_types: condition.pop_types,
    employment_building_groups: condition.employment_building_groups,
    laws: condition.laws,
    technologies: condition.technologies,
    cultures: condition.cultures,
    countries: condition.countries,
  };
}

function interestGroupPopAttractionCondition(values, loc) {
  const valueList = values || [];
  const popTypes = collectInterestGroupPopAttractionConditionValues(valueList, "is_pop_type");
  const employmentBuildingGroups = collectInterestGroupPopAttractionConditionValues(valueList, "pop_employment_building_group");
  const lawKeys = [...new Set(valueList.flatMap((value) => [...collectLawRefs(value)]))].sort();
  const technologyKeys = [...new Set(valueList.flatMap((value) => [...collectTechnologyRefs(value)]))].sort();
  const cultureKeys = collectInterestGroupPopAttractionConditionValues(valueList, "culture")
    .filter((item) => !item.negated)
    .map((item) => item.key);
  const countryKeys = collectInterestGroupPopAttractionCountryKeys(valueList);
  const literacyConditions = collectInterestGroupPopAttractionComparisons(valueList, "literacy_rate");
  const parts = [];
  if (literacyConditions.length) parts.push(`识字率：${literacyConditions.join("、")}`);
  if (lawKeys.length) parts.push(`法律：${lawKeys.map((key) => locCleanName(loc, key)).join("、")}`);
  if (technologyKeys.length) parts.push(`科技：${technologyKeys.map((key) => locCleanName(loc, key)).join("、")}`);
  if (cultureKeys.length) parts.push(`文化：${cultureKeys.map((key) => locCleanName(loc, key)).join("、")}`);
  if (countryKeys.length) parts.push(`国家：${countryKeys.map((key) => locCleanName(loc, key)).join("、")}`);
  return {
    summary_zh: parts.join("；"),
    raw: valueList.map((item) => stringifyScriptValue(item)).filter(Boolean).join("\n"),
    pop_types: popTypes.map((item) => ({ key: item.key, name_zh: locCleanName(loc, item.key), negated: item.negated })),
    employment_building_groups: employmentBuildingGroups.map((item) => ({ key: item.key, name_zh: locCleanName(loc, item.key), negated: item.negated })),
    laws: refObjects(lawKeys, loc, "law"),
    technologies: refsToObjects(technologyKeys, loc),
    cultures: cultureKeys.map((key) => ({ key, name_zh: locCleanName(loc, key) })),
    countries: countryKeys.map((key) => ({ key, name_zh: locCleanName(loc, key) })),
  };
}

function collectInterestGroupPopAttractionConditionValues(values, assignmentKey) {
  const found = new Map();
  const visit = (value, negated = false) => {
    const node = asNode(value);
    if (!node) return;
    for (const assignment of node.assignments || []) {
      if (assignment.key === assignmentKey) {
        const scalar = stripPrefix(scalarFromValue(assignment.value));
        if (scalar) found.set(`${negated ? "not:" : ""}${scalar}`, { key: scalar, negated });
      }
      visit(assignment.value, negated || assignment.key === "NOT");
    }
    for (const item of node.items || []) visit(item, negated);
  };
  for (const value of values || []) visit(value);
  return [...found.values()].sort((left, right) => left.key.localeCompare(right.key) || Number(left.negated) - Number(right.negated));
}

function collectInterestGroupPopAttractionCountryKeys(values) {
  const found = new Set();
  const visit = (value) => {
    const node = asNode(value);
    if (!node) return;
    for (const assignment of node.assignments || []) {
      const match = String(assignment.key || "").match(/^c:([A-Z0-9_]+)$/);
      if (match) found.add(match[1]);
      visit(assignment.value);
    }
    for (const item of node.items || []) visit(item);
  };
  for (const value of values || []) visit(value);
  return [...found].sort();
}

function collectInterestGroupPopAttractionComparisons(values, key) {
  const found = new Set();
  const visit = (value) => {
    const node = asNode(value);
    if (!node) return;
    for (const assignment of node.assignments || []) {
      if (assignment.key === key && assignment.op && assignment.op !== "=") {
        const scalar = scalarFromValue(assignment.value);
        if (scalar) found.add(`${assignment.op} ${scalar}`);
      }
      visit(assignment.value);
    }
    for (const item of node.items || []) visit(item);
  };
  for (const value of values || []) visit(value);
  return [...found];
}

function collectIdeologyUnlockSources({ interestGroupDir, politicalMovementDir, eventDirs, loc }) {
  const records = [];
  for (const file of listFiles(interestGroupDir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const groupKey = scriptEntryKey(assignment.key);
      if (!groupKey.startsWith("ig_")) continue;
      const node = asNode(assignment.value);
      const onEnable = node ? firstValue(node, "on_enable") : null;
      collectInterestGroupIdeologyUnlocks(onEnable, {
        file,
        ownerKey: groupKey,
        ownerNameZh: locName(loc, groupKey),
        loc,
      }, [], records);
    }
  }

  for (const file of listFiles(politicalMovementDir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const movementKey = scriptEntryKey(assignment.key);
      if (!movementKey.startsWith("movement_")) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      const trigger = firstValue(node, "creation_trigger");
      const technologies = refsToObjects([...collectTechnologyRefs(trigger)].sort(), loc);
      const journals = journalRefsToObjects(collectJournalEntryRefs(trigger), loc);
      const source = {
        kind: "political_movement",
        source_key: movementKey,
        source_name_zh: locName(loc, movementKey),
        source_file: normalizePath(file),
        condition_summary_zh: summarizeUnlockCondition(trigger, loc),
        condition_raw: stringifyScriptValue(trigger),
      };
      const ideologyKeys = [
        stripPrefix(firstScalar(node, "ideology")),
        ...nodeItems(asNode(firstValue(node, "character_ideologies")) || { items: [] }).map(stripPrefix),
      ].filter((key) => key?.startsWith("ideology_"));
      for (const ideologyKey of ideologyKeys) {
        records.push({
          ideology_key: normalizeIdeologyUnlockKey(ideologyKey),
          technologies,
          journal_entries: journals,
          ...source,
        });
      }
    }
  }

  for (const dir of eventDirs || []) {
    for (const file of listFiles(dir)) {
      const root = parseScript(readText(file), file);
      collectEventIdeologyUnlocks(root, {
        file,
        loc,
      }, [], records);
    }
  }

  records.push(...knownIdeologyUnlockFallbacks({
    commonRoot: commonRootFromContentPath(interestGroupDir),
    loc,
  }));

  return records;
}

function commonRootFromContentPath(targets) {
  const list = Array.isArray(targets) ? targets : [targets];
  const firstExisting = list.find((target) => target && fs.existsSync(target)) || list.find(Boolean) || "";
  return firstExisting ? path.dirname(firstExisting) : "";
}

function knownIdeologyUnlockFallbacks({ commonRoot, loc }) {
  const politicalMovementFile = path.join(commonRoot, "political_movements", "00_ideological_movements.txt");
  const technocracyJournalFile = path.join(commonRoot, "journal_entries", "05_technocracy.txt");
  const suffragistsJournalFile = path.join(commonRoot, "journal_entries", "00_suffragists.txt");
  const devoutFile = path.join(commonRoot, "interest_groups", "00_devout.txt");
  const rows = [
    {
      ideology_key: "ideology_communist",
      kind: "political_movement",
      source_key: "movement_communist",
      source_file: politicalMovementFile,
      technologies: ["socialism"],
    },
    {
      ideology_key: "ideology_anarchist",
      kind: "political_movement",
      source_key: "movement_anarchist",
      source_file: politicalMovementFile,
      technologies: ["anarchism", "socialism"],
    },
    {
      ideology_key: "ideology_vanguardist",
      kind: "political_movement",
      source_key: "movement_communist",
      source_file: politicalMovementFile,
      technologies: ["socialism"],
    },
    {
      ideology_key: "ideology_corporatist",
      kind: "political_movement",
      source_key: "movement_corporatist",
      source_file: politicalMovementFile,
      technologies: ["corporatism"],
    },
    {
      ideology_key: "ideology_fascist",
      kind: "political_movement",
      source_key: "movement_fascist",
      source_file: politicalMovementFile,
      technologies: ["political_agitation"],
    },
    {
      ideology_key: "ideology_technocratic",
      kind: "event_or_journal",
      source_key: "je_technocracy",
      source_file: technocracyJournalFile,
      journal_entries: ["je_technocracy"],
    },
    {
      ideology_key: "ideology_patriarchal_suffrage",
      kind: "event_or_journal",
      source_key: "je_suffragists",
      source_file: suffragistsJournalFile,
      technologies: ["feminism"],
      journal_entries: ["je_suffragists"],
    },
    {
      ideology_key: "ideology_modern_patriarchal",
      kind: "event_or_journal",
      source_key: "je_suffragists",
      source_file: suffragistsJournalFile,
      technologies: ["feminism"],
      journal_entries: ["je_suffragists"],
    },
    {
      ideology_key: "ideology_conservative_patriarchal",
      kind: "event_or_journal",
      source_key: "je_suffragists",
      source_file: suffragistsJournalFile,
      technologies: ["feminism"],
      journal_entries: ["je_suffragists"],
    },
    {
      ideology_key: "ideology_reactionary_patriarchal",
      kind: "event_or_journal",
      source_key: "je_suffragists",
      source_file: suffragistsJournalFile,
      technologies: ["feminism"],
      journal_entries: ["je_suffragists"],
    },
    {
      ideology_key: "ideology_pious",
      kind: "interest_group_flavor",
      source_key: "ig_devout",
      source_file: devoutFile,
      technologies: ["rationalism"],
    },
  ];

  return rows.map((row) => ({
    ideology_key: row.ideology_key,
    kind: row.kind,
    source_key: row.source_key,
    source_name_zh: locName(loc, row.source_key),
    source_file: normalizePath(row.source_file),
    condition_summary_zh: [
      ...(row.technologies || []).map((key) => `科技：${locName(loc, key)}`),
      ...(row.journal_entries || []).map((key) => `日志条目：${locName(loc, key)}`),
    ].join("；") || "脚本来源",
    condition_raw: "",
    technologies: refsToObjects(row.technologies || [], loc),
    journal_entries: journalRefsToObjects(new Set(row.journal_entries || []), loc),
    action: "unlock_source",
  }));
}

function collectInterestGroupIdeologyUnlocks(value, context, conditions, out) {
  const node = asNode(value);
  if (!node) return;
  for (let index = 0; index < node.assignments.length; index += 1) {
    const assignment = node.assignments[index];
    if (assignment.key === "if") {
      const chain = [assignment];
      let cursor = index + 1;
      while (cursor < node.assignments.length && (node.assignments[cursor].key === "else_if" || node.assignments[cursor].key === "else")) {
        chain.push(node.assignments[cursor]);
        cursor += 1;
      }
      for (const branch of chain) {
        const branchNode = asNode(branch.value);
        const limit = branch.key === "else" ? null : (branchNode ? firstValue(branchNode, "limit") : null);
        const condition = branch.key === "else"
          ? { summary_zh: "其他情况", raw: "else" }
          : {
            summary_zh: summarizeUnlockCondition(limit, context.loc),
            raw: stringifyScriptValue(limit),
          };
        collectInterestGroupIdeologyUnlocks(branch.value, context, [...conditions, condition], out);
      }
      index = cursor - 1;
      continue;
    }
    if (assignment.key === "else_if" || assignment.key === "else" || assignment.key === "limit") continue;
    if (assignment.key === "add_ideology" || assignment.key === "remove_ideology") {
      const ideologyKey = normalizeIdeologyUnlockKey(stripPrefix(scalarFromValue(assignment.value)));
      if (ideologyKey) {
        out.push({
          ideology_key: ideologyKey,
          kind: "interest_group_flavor",
          source_key: context.ownerKey,
          source_name_zh: context.ownerNameZh,
          source_file: normalizePath(context.file),
          condition_summary_zh: combineConditionSummaries(conditions).summary_zh,
          condition_raw: combineConditionSummaries(conditions).raw,
          technologies: refsToObjects([...collectTechnologyRefs(conditions.map((item) => item.raw).join("\n"))].sort(), context.loc),
          journal_entries: journalRefsToObjects(collectJournalEntryRefs(conditions.map((item) => item.raw).join("\n")), context.loc),
          action: assignment.key,
        });
      }
    }
    collectInterestGroupIdeologyUnlocks(assignment.value, context, conditions, out);
  }
}

function collectEventIdeologyUnlocks(value, context, conditions, out) {
  const node = asNode(value);
  if (!node) return;
  for (const assignment of node.assignments) {
    const nextConditions = assignment.key === "trigger" || assignment.key === "limit"
      ? [...conditions, {
        summary_zh: summarizeUnlockCondition(assignment.value, context.loc),
        raw: stringifyScriptValue(assignment.value),
      }]
      : conditions;
    const ideologyKeys = ideologyKeysFromEffectAssignment(assignment);
    if (ideologyKeys.length) {
      const conditionSummary = combineConditionSummaries(nextConditions);
      for (const ideologyKey of ideologyKeys) {
        out.push({
          ideology_key: normalizeIdeologyUnlockKey(ideologyKey),
          kind: "event_or_journal",
          source_key: scriptEntryKey(path.basename(context.file, path.extname(context.file))),
          source_name_zh: locName(context.loc, scriptEntryKey(path.basename(context.file, path.extname(context.file)))),
          source_file: normalizePath(context.file),
          condition_summary_zh: conditionSummary.summary_zh,
          condition_raw: conditionSummary.raw,
          technologies: refsToObjects([...collectTechnologyRefs(assignment.value), ...collectTechnologyRefs(conditionSummary.raw)].sort(), context.loc),
          journal_entries: journalRefsToObjects(new Set([
            ...collectJournalEntryRefs(assignment.value),
            ...collectJournalEntryRefs(conditionSummary.raw),
            ...collectJournalEntryRefsFromText(conditionSummary.raw),
            ...collectJournalEntryRefsFromText(stringifyScriptValue(assignment.value)),
          ]), context.loc),
          action: assignment.key,
        });
      }
    }
    collectEventIdeologyUnlocks(assignment.value, context, nextConditions, out);
  }
}

function ideologyKeysFromEffectAssignment(assignment) {
  if (![
    "add_ideology",
    "remove_ideology",
    "set_ideology",
    "remove_character_ideology",
    "set_core_ideology",
    "ideology",
  ].includes(assignment.key)) return [];
  const scalar = stripPrefix(scalarFromValue(assignment.value));
  return scalar?.startsWith("ideology_") ? [scalar] : [];
}

function applyIdeologyUnlockSources(ideologies, records) {
  const byIdeology = groupBy(records.filter((record) => record.ideology_key), "ideology_key");
  for (const [key, ideology] of ideologies.entries()) {
    const mappedRecords = byIdeology.get(key) || [];
    ideology.unlock_sources = uniqueUnlockSources(mappedRecords);
    ideology.unlock_technologies = uniqueRefs(mappedRecords.flatMap((record) => record.technologies || []));
    ideology.unlock_journal_entries = uniqueRefs(mappedRecords.flatMap((record) => record.journal_entries || []));
  }
}

function applyIdeologyDefinitionUsage(ideologies, interestGroups, loc) {
  const assignedKeys = new Set();
  for (const group of interestGroups || []) {
    for (const key of [
      ...(group._base_ideology_keys || []),
      ...(group._character_ideology_keys || []),
    ]) {
      if (key) assignedKeys.add(key);
    }
    collectAssignedIdeologyKeys(group._on_enable, assignedKeys);
  }
  for (const [key, ideology] of ideologies.entries()) {
    const sourceFile = path.basename(ideology.source_file || "").toLowerCase();
    const isFlavorDefinition = sourceFile.includes("flavor") || sourceFile.includes("flavoured") || sourceFile.includes("flavored");
    const hint = knownFlavorDefinitionHints.get(key);
    if (!isFlavorDefinition && !hint) continue;
    ideology.flavor_definition_status = assignedKeys.has(key) ? "assigned" : (hint?.status || "unassigned");
    ideology.flavor_definition_note_zh = hint?.note_zh || (
      assignedKeys.has(key)
        ? "风味意识形态定义，已在脚本中分配。"
        : "风味意识形态定义；当前脚本未分配给任何利益集团。"
    );
    ideology.flavor_definition_source = {
      key,
      name_zh: locName(loc, key),
      source_file: ideology.source_file || "",
    };
  }
}

function collectAssignedIdeologyKeys(value, out) {
  const node = asNode(value);
  if (!node) return out;
  for (const assignment of node.assignments) {
    if (assignment.key === "add_ideology" || assignment.key === "remove_ideology") {
      const key = normalizeIdeologyUnlockKey(stripPrefix(scalarFromValue(assignment.value)));
      if (key) out.add(key);
    }
    collectAssignedIdeologyKeys(assignment.value, out);
  }
  for (const item of node.items) collectAssignedIdeologyKeys(item, out);
  return out;
}

function uniqueUnlockSources(records) {
  const seen = new Set();
  const result = [];
  for (const record of records || []) {
    const key = [
      record.kind,
      record.source_key,
      record.source_file,
      record.condition_summary_zh,
      (record.technologies || []).map((item) => item.key).join(","),
      (record.journal_entries || []).map((item) => item.key).join(","),
      record.action,
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      kind: record.kind,
      source_key: record.source_key,
      source_name_zh: record.source_name_zh,
      source_file: record.source_file,
      condition_summary_zh: record.condition_summary_zh,
      condition_raw: record.condition_raw,
      technologies: uniqueRefs(record.technologies || []),
      journal_entries: uniqueRefs(record.journal_entries || []),
      action: record.action,
    });
  }
  return result;
}

function publicInterestGroup(group) {
  const {
    _on_enable,
    _base_trait_keys,
    _base_ideology_keys,
    _character_ideology_keys,
    ...publicData
  } = group;
  return publicData;
}

function countInterestGroupFlavorRules(value) {
  let count = 0;
  const node = asNode(value);
  if (!node) return count;
  for (const assignment of node.assignments) {
    if (assignment.key === "if" || assignment.key === "else_if" || assignment.key === "else") count += 1;
    count += countInterestGroupFlavorRules(assignment.value);
  }
  return count;
}

function loadNamedColors(dir) {
  const colors = new Map();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    const colorsNode = asNode(firstValue(root, "colors"));
    if (!colorsNode) continue;
    for (const assignment of colorsNode.assignments) {
      const key = scriptEntryKey(assignment.key);
      const color = parseColorValue(assignment.value);
      if (!color) continue;
      colors.set(key, {
        key,
        ...color,
        file: normalizePath(file),
      });
    }
  }
  return colors;
}

function buildCountryRow(context) {
  const {
    tag,
    def,
    loc,
    cultures,
    startingOwners,
    startingSubjectsByTag,
    startingCountryData,
    startingDiplomacy,
    historyCountryTags,
    historyReligionOverrides,
    releasables,
    formables,
    canFormByCulture,
    dynamicNameVariantsByScope,
    dynamicMapColorRulesByTag,
  } = context;
  const startingStates = [...(startingOwners.get(tag) || [])].sort();
  const startingSubject = startingSubjectsByTag.get(tag);
  const startingData = startingCountryData.get(tag) || { technology_tier: null, technology_template: "", technology_eras: [], template_technologies: [], technologies: [], laws: [], source_file: "" };
  const diplomacy = startingDiplomacy.get(tag) || [];
  const primaryCultures = def?.cultures || [];
  const primaryCulturesZh = primaryCultures.map((key) => locName(loc, key));
  const historyReligion = historyReligionOverrides.get(tag)?.religion || "";
  const directReligion = def?.religion || "";
  const fallbackReligion = primaryCultures
    .map((culture) => cultures.get(culture)?.religion)
    .find(Boolean) || "";
  const religion = historyReligion || directReligion || fallbackReligion;
  const religionSource = historyReligion
    ? "历史开局"
    : directReligion
    ? "国家定义"
    : (fallbackReligion ? "首个主流文化" : "");
  const formable = formables.get(tag);
  const releasable = releasables.get(tag);
  const canFormTags = canFormByCulture.get(tag) || [];
  const nameVariants = dynamicNameVariantsByScope.get(tag) || [];
  const mapColorRules = dynamicMapColorRulesByTag.get(tag) || [];
  const localizedName = locName(loc, tag);
  return {
    tag,
    name_zh: disambiguateCountryName(tag, localizedName),
    exists_at_start: startingStates.length > 0 ? "是" : "否",
    starting_state_count: String(startingStates.length),
    starting_states: joinValues(startingStates),
    starting_overlord_tag: startingSubject?.overlord_tag || "",
    starting_subject_type: startingSubject?.type || "",
    starting_subject_uses_overlord_color: startingSubject?.uses_overlord_color ? "是" : "否",
    starting_technology_tier: startingData.technology_tier == null ? "" : String(startingData.technology_tier),
    starting_technology_template: startingData.technology_template || "",
    starting_technology_eras: joinValues(startingData.technology_eras || []),
    starting_technology_template_keys: joinValues((startingData.template_technologies || []).map((technology) => technology.key)),
    starting_technology_keys: joinValues(startingData.technologies.map((technology) => technology.key)),
     starting_law_keys: startingStates.length ? joinValues(startingData.laws.map((law) => law.key)) : "",
     starting_laws: startingStates.length ? startingData.laws : [],
    starting_diplomacy: diplomacy,
    has_history_country_file: historyCountryTags.has(tag) ? "是" : "否",
    is_releasable: releasable ? "是" : "否",
    is_formable: formable ? "是" : "否",
    is_major_formable: formable?.is_major_formable ? "是" : "否",
    can_form_tags_by_primary_culture: joinValues(canFormTags),
    can_form_names_zh_by_primary_culture: joinValues(canFormTags.map((targetTag) => locName(loc, targetTag))),
    primary_cultures: joinValues(primaryCultures),
    primary_cultures_zh: joinValues(primaryCulturesZh),
    religion,
    religion_zh: religion ? locName(loc, religion) : "",
    religion_source: religionSource,
    tier: def?.tier || "",
    tier_zh: def?.tier ? (tierZh[def.tier] || def.tier) : "",
    tier_prestige: def?.tier && tierPrestige[def.tier] !== undefined ? String(tierPrestige[def.tier]) : "",
    color_rgb: def?.color?.rgb ? def.color.rgb.join(" ") : "",
    color_hex: def?.color?.hex || "",
    primary_unit_color: def?.primary_unit_color || "",
    secondary_unit_color: def?.secondary_unit_color || "",
    tertiary_unit_color: def?.tertiary_unit_color || "",
    country_type: def?.country_type || "",
    country_type_zh: def?.country_type ? (loc.get(def.country_type) || countryTypeZh[def.country_type] || def.country_type) : "",
    capital: def?.capital || "",
    capital_zh: def?.capital ? locName(loc, def.capital) : "",
    dynamic_name_variant_count: String(nameVariants.length),
    dynamic_map_color_rule_count: String(mapColorRules.length),
    formation_required_cultures: joinValues(formable?.required_cultures || []),
    formation_required_cultures_zh: joinValues((formable?.required_cultures || []).map((key) => locName(loc, key))),
    formation_states: joinValues(formable?.states || []),
    formation_region: formable?.geographic_region || "",
    release_states: joinValues(releasable?.states || []),
    definition_file: def?.file || "",
  };
}

function disambiguateCountryName(tag, nameZh) {
  if (tag === "BIC" && nameZh === "东印度") return "东印度（英属）";
  if (tag === "DEI" && nameZh === "东印度") return "东印度（荷属）";
  return nameZh;
}

function buildRuleRow(rule, loc) {
  return {
    tag: rule.tag,
    name_zh: locName(loc, rule.tag),
    is_major_formable: rule.is_major_formable ? "是" : "否",
    use_culture_states: rule.use_culture_states ? "是" : "否",
    required_states_fraction: rule.required_states_fraction || "",
    required_num_states: rule.required_num_states || "",
    states: joinValues(rule.states),
    states_zh: joinValues(rule.states.map((state) => locName(loc, state))),
    geographic_region: rule.geographic_region || "",
    geographic_region_zh: rule.geographic_region ? locName(loc, rule.geographic_region) : "",
    candidate_cultures: joinValues(rule.candidate_cultures || []),
    candidate_cultures_zh: joinValues((rule.candidate_cultures || []).map((culture) => locName(loc, culture))),
    required_cultures: joinValues(rule.required_cultures),
    required_cultures_zh: joinValues(rule.required_cultures.map((culture) => locName(loc, culture))),
    referenced_tags: joinValues(rule.referenced_tags),
    source_file: rule.file,
  };
}

function locName(loc, key) {
  if (!key) return "";
  return loc.get(key) || loc.get(key.toUpperCase()) || key;
}

function locAliasKey(value) {
  const match = String(value || "").match(/^\$([A-Za-z0-9_:.]+)(?:\|[^$]+)?\$$/);
  return match ? match[1] : "";
}

function locCleanName(loc, key) {
  return cleanLocalizationText(locName(loc, key), loc);
}

function addFormationCandidateCultures(formables, definitions) {
  for (const rule of formables.values()) {
    const cultures = new Set(rule.required_cultures);
    const targetCultures = definitions.get(rule.tag)?.cultures || [];
    if (cultures.size === 0 || rule.use_culture_states) {
      for (const culture of targetCultures) cultures.add(culture);
    }
    rule.candidate_cultures = [...cultures].sort();
  }
}

function buildCanFormByCulture(definitions, formables) {
  const result = new Map();
  for (const [sourceTag, def] of definitions.entries()) {
    if (def.dynamic) continue;
    const primaryCultures = new Set(def.cultures || []);
    const targets = [];
    for (const rule of formables.values()) {
      if (rule.tag === sourceTag) continue;
      const candidateCultures = rule.candidate_cultures || [];
      if (candidateCultures.some((culture) => primaryCultures.has(culture))) {
        targets.push(rule.tag);
      }
    }
    result.set(sourceTag, targets.sort());
  }
  return result;
}

function buildRelatedCountriesByCulture(definitions, loc) {
  const result = new Map();
  for (const def of definitions.values()) {
    if (def.dynamic) continue;
    for (const culture of def.cultures || []) {
      if (!result.has(culture)) result.set(culture, []);
      result.get(culture).push({
        id: `country:${def.tag}`,
        tag: def.tag,
        name_zh: locName(loc, def.tag),
      });
    }
  }
  for (const countries of result.values()) {
    countries.sort((a, b) => a.tag.localeCompare(b.tag));
  }
  return result;
}

function buildCultureRows(cultures, cultureTraits, cultureTraitGroups, relatedCountriesByCulture, stateRegionRows, loc, goodsLoc = loc) {
  const cultureKeysByTrait = new Map();
  const cultureKeysByTraitGroup = new Map();
  const stateRegionByKey = new Map(stateRegionRows.map((stateRegion) => [stateRegion.key, stateRegion]));
  const stateRegionKeysByCulture = new Map();
  const strategicRegionKeysByCulture = new Map();
  for (const stateRegion of stateRegionRows) {
    for (const cultureRef of stateRegion.homeland_cultures || []) {
      pushMapSet(stateRegionKeysByCulture, cultureRef.key, stateRegion.key);
      for (const strategicRegion of stateRegion.strategic_regions || []) {
        pushMapSet(strategicRegionKeysByCulture, cultureRef.key, strategicRegion.key);
      }
    }
  }
  for (const culture of cultures.values()) {
    for (const traitKey of culture.trait_keys || []) {
      pushMapSet(cultureKeysByTrait, traitKey, culture.key);
      const groupKey = cultureTraits.get(traitKey)?.group_key || "";
      if (groupKey) pushMapSet(cultureKeysByTraitGroup, groupKey, culture.key);
    }
  }

  return [...cultures.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((culture) => {
      const traitObjects = (culture.trait_keys || []).map((traitKey) => cultureTraitRef(traitKey, cultureTraits));
      const groupKeys = unique(traitObjects.map((trait) => trait.group_key).filter(Boolean)).sort();
      return {
        id: `culture:${culture.key}`,
        key: culture.key,
        name_zh: locName(loc, culture.key),
        color: {
          rgb: culture.color?.rgb || null,
          hex: culture.color?.hex || "",
          source: "common/cultures",
        },
        religion: {
          id: culture.religion ? `religion:${culture.religion}` : "",
          key: culture.religion,
          name_zh: culture.religion ? locName(loc, culture.religion) : "",
        },
        heritage: cultureTraitRef(culture.heritage, cultureTraits),
        language: cultureTraitRef(culture.language, cultureTraits),
        traditions: (culture.traditions || []).map((traitKey) => cultureTraitRef(traitKey, cultureTraits)),
        traits: traitObjects,
        trait_groups: groupKeys.map((groupKey) => cultureTraitGroupRef(groupKey, cultureTraitGroups)),
        static_obsessions: (culture.static_obsessions || []).map((goodsKey) => goodsRef(goodsKey, goodsLoc)),
        starting_obsessions: (culture.starting_obsessions || []).map((entry) => ({
          id: `starting_culture_obsession:${culture.key}:${entry.good_key}`,
          key: entry.good_key,
          name_zh: locName(goodsLoc, entry.good_key),
          sources: entry.sources.map((source) => ({
            id: source.id,
            key: source.journal_key,
            name_zh: source.journal_name_zh,
            country_tags: source.country_tags,
            journal_file: source.journal_file,
            script_key: source.script_key,
            script_file: source.script_file,
          })),
        })),
        obsessions: (culture.obsessions || []).map((goodsKey) => goodsRef(goodsKey, goodsLoc)),
        taboos: (culture.taboos || []).map((goodsKey) => goodsRef(goodsKey, goodsLoc)),
        related_countries: relatedCountriesByCulture.get(culture.key) || [],
        homeland_state_regions: [...(stateRegionKeysByCulture.get(culture.key) || [])]
          .sort((a, b) => stateRegionOrderValue(a, stateRegionByKey) - stateRegionOrderValue(b, stateRegionByKey) || a.localeCompare(b))
          .map((key) => stateRegionRef(key, stateRegionByKey, loc)),
        homeland_strategic_regions: [...(strategicRegionKeysByCulture.get(culture.key) || [])]
          .sort((a, b) => strategicRegionOrderValue(a) - strategicRegionOrderValue(b) || a.localeCompare(b))
          .map((key) => strategicRegionKeyRef(key, loc)),
        same_heritage_cultures: relatedCultureRefs(cultureKeysByTrait.get(culture.heritage), culture.key, loc),
        same_language_cultures: relatedCultureRefs(cultureKeysByTrait.get(culture.language), culture.key, loc),
        same_trait_group_cultures: Object.fromEntries(groupKeys.map((groupKey) => [
          groupKey,
          relatedCultureRefs(cultureKeysByTraitGroup.get(groupKey), culture.key, loc),
        ])),
        source: {
          file: culture.file,
        },
      };
    });
}

function cultureTraitRef(key, cultureTraits) {
  if (!key) return null;
  const trait = cultureTraits.get(key);
  return {
    id: `culture_trait:${key}`,
    key,
    name_zh: trait?.name_zh || key,
    type: trait?.type || "",
    type_zh: trait?.type_zh || "",
    group_key: trait?.group_key || "",
    group_name_zh: trait?.group_name_zh || "",
  };
}

function cultureTraitGroupRef(key, cultureTraitGroups) {
  const group = cultureTraitGroups.get(key);
  return {
    id: `culture_trait_group:${key}`,
    key,
    name_zh: group?.name_zh || key,
    type: group?.type || "",
    type_zh: group?.type_zh || "",
  };
}

function goodsRef(key, loc) {
  return {
    id: `goods:${key}`,
    key,
    name_zh: locName(loc, key),
  };
}

function buildingRef(key, loc) {
  return {
    id: `building:${key}`,
    key,
    name_zh: locName(loc, key),
  };
}

function prestigeGoodRef(key, loc) {
  return {
    id: `prestige_good:${key}`,
    key,
    name_zh: locName(loc, key),
  };
}

function technologyRef(key, technologies, loc) {
  const technology = technologies instanceof Map ? technologies.get(key) : technologies.find((item) => item.key === key);
  return {
    id: `technology:${key}`,
    key,
    name_zh: technology?.name_zh || locName(loc, key),
    loc: { name: `technology:${key}.name` },
    icon: technology?.icon || "",
    category: technology?.category || "",
    category_zh: technology?.category_zh || "",
    era: technology?.era || "",
    era_label_zh: technology?.era_label_zh || "",
  };
}

function lawRef(key, laws, loc, metadata = {}) {
  const law = laws instanceof Map ? laws.get(key) : laws.find((item) => item.key === key);
  return {
    id: `law:${key}`,
    key,
    name_zh: law?.name_zh || locName(loc, key),
    loc: { name: `law:${key}.name` },
    icon: law?.icon || "",
    group: law?.group_key || "",
    group_name_zh: law?.group_name_zh || locName(loc, law?.group_key || ""),
    group_sort_order: metadata.group_sort_order ?? null,
    category: metadata.category || "",
    source: metadata.source || "",
    source_detail: metadata.source_detail || "",
  };
}

function amendmentRef(key, amendments) {
  const amendment = amendments.get(key);
  return { id: amendment?.id || `law_amendment:${key}`, key, loc: { name: `law_amendment:${key}.name` } };
}

function interestGroupRef(key, groups) {
  const group = groups instanceof Map ? groups.get(key) : null;
  return {
    id: `interest_group:${key}`,
    key,
    name_zh: group?.name_zh || key,
    color: group?.color || null,
  };
}

function interestGroupTraitRef(key, interestGroupTraits) {
  const trait = interestGroupTraits.get(key);
  return {
    id: `interest_group_trait:${key}`,
    key,
    name_zh: trait?.name_zh || key,
    desc_zh: trait?.desc_zh || "",
    icon: trait?.icon || "",
    min_approval: trait?.min_approval || "",
    max_approval: trait?.max_approval || "",
    modifiers: trait?.modifiers || [],
    modifier_summary_zh: trait?.modifier_summary_zh || "",
  };
}

function ideologyRef(key, ideologies) {
  const ideology = ideologies.get(key);
  return {
    id: `ideology:${key}`,
    key,
    name_zh: ideology?.name_zh || key,
    desc_zh: ideology?.desc_zh || "",
    icon: ideology?.icon || "",
  };
}

function companyBuildingRefs(value, loc) {
  const node = asNode(value);
  if (!node) return [];
  return nodeItems(node).map(stripPrefix).filter(Boolean).sort().map((key) => buildingRef(key, loc));
}

function prestigeGoodRefs(value, loc) {
  const node = asNode(value);
  if (!node) return [];
  return nodeItems(node).map(stripPrefix).filter(Boolean).sort().map((key) => prestigeGoodRef(key, loc));
}

function companyStateRegionRefs(value, stateRegionByKey, loc) {
  const node = asNode(value);
  if (!node) return [];
  return sortStateRegionKeys(nodeItems(node).map(stripPrefix).filter((key) => key.startsWith("STATE_")), stateRegionByKey)
    .map((key) => stateRegionRef(key, stateRegionByKey, loc));
}

function stateTraitRef(key, loc, stateTraits = new Map()) {
  const trait = stateTraits.get(key);
  if (trait) {
    return {
      id: trait.id,
      key,
      name_zh: trait.name_zh,
      icon: trait.icon,
      categories: trait.categories,
      category_zh: trait.category_zh,
      modifiers: trait.modifiers,
      modifier_summary_zh: trait.modifier_summary_zh,
      has_mapi: trait.has_mapi,
      mapi_value_zh: trait.mapi_value_zh,
      required_techs_for_colonization: trait.required_techs_for_colonization,
      disabling_technologies: trait.disabling_technologies,
      source_file: trait.source_file,
    };
  }
  return {
    id: `state_trait:${key}`,
    key,
    name_zh: locName(loc, key),
    icon: "",
    categories: [],
    category_zh: "",
    modifiers: [],
    modifier_summary_zh: "",
    has_mapi: false,
    mapi_value_zh: "",
  };
}

function countryKeyRef(tag, loc) {
  return {
    id: `country:${tag}`,
    tag,
    name_zh: locName(loc, tag),
  };
}

function cultureKeyRef(key, loc) {
  return {
    id: `culture:${key}`,
    key,
    name_zh: locName(loc, key),
  };
}

function stateRegionRef(key, stateRegions, loc) {
  const stateRegion = stateRegions instanceof Map ? stateRegions.get(key) : null;
  return {
    id: `state_region:${key}`,
    key,
    name_zh: stateRegion?.name_zh || (loc ? locName(loc, key) : key),
  };
}

function strategicRegionRef(key, strategicRegions) {
  const strategicRegion = strategicRegions.get(key);
  return {
    id: `strategic_region:${key}`,
    key,
    name_zh: strategicRegion?.name_zh || key,
  };
}

function strategicRegionKeyRef(key, loc) {
  return {
    id: `strategic_region:${key}`,
    key,
    name_zh: locName(loc, key),
  };
}

function resourceRef(value, loc) {
  const node = asNode(value);
  if (!node) return null;
  const type = stripPrefix(firstScalar(node, "type"));
  if (!type) return null;
  return {
    key: type,
    name_zh: locName(loc, type),
    depleted_type: stripPrefix(firstScalar(node, "depleted_type")),
    depleted_type_name_zh: locName(loc, stripPrefix(firstScalar(node, "depleted_type"))),
    amount: toNumberOrNull(firstScalar(node, "amount")),
    undiscovered_amount: toNumberOrNull(firstScalar(node, "undiscovered_amount")),
    discovered_amount: toNumberOrNull(firstScalar(node, "discovered_amount")),
    depleted_amount: toNumberOrNull(firstScalar(node, "depleted_amount")),
  };
}

function sortByNameZh(a, b) {
  return (a.name_zh || a.key || "").localeCompare(b.name_zh || b.key || "", "zh-Hans-CN") || (a.key || "").localeCompare(b.key || "");
}

function sortStateRegionKeys(keys, stateRegions) {
  return unique(keys).sort((a, b) => (
    stateRegionOrderValue(a, stateRegions) - stateRegionOrderValue(b, stateRegions)
    || a.localeCompare(b)
  ));
}

function stateRegionOrderValue(key, stateRegions) {
  const stateRegion = stateRegions instanceof Map ? stateRegions.get(key) : null;
  return Number.isFinite(stateRegion?.numeric_id) ? stateRegion.numeric_id : Number.MAX_SAFE_INTEGER;
}

function sortStrategicRegionKeys(keys, strategicRegions) {
  return unique(keys).sort((a, b) => (
    strategicRegionOrderValue(a) - strategicRegionOrderValue(b)
    || (strategicRegions?.get(a)?.name_zh || a).localeCompare(strategicRegions?.get(b)?.name_zh || b, "zh-Hans-CN")
    || a.localeCompare(b)
  ));
}

function strategicRegionOrderValue(key) {
  return strategicRegionOrderByKey.has(key) ? strategicRegionOrderByKey.get(key) : Number.MAX_SAFE_INTEGER;
}

function relatedCultureRefs(cultureKeys, currentKey, loc) {
  return [...(cultureKeys || [])]
    .filter((key) => key && key !== currentKey)
    .sort()
    .map((key) => ({
      id: `culture:${key}`,
      key,
      name_zh: locName(loc, key),
    }));
}

function countryInterestGroupFlavors(interestGroups, context) {
  if (context.country_type === "decentralized") return [];
  const groupsByKey = new Map(interestGroups.map((group) => [group.key, group]));
  return interestGroups.map((group) => {
    const runtime = {
      displayNameKey: group.key,
      traitKeys: [],
      addedIdeologyKeys: [],
      removedIdeologyKeys: [],
      effects: [],
      sourceFile: group.source_file,
    };
    executeInterestGroupEffects(group._on_enable, context, runtime, []);
    const activeTraitKeys = runtime.traitKeys.length ? unique(runtime.traitKeys) : group._base_trait_keys;
    const removed = new Set(runtime.removedIdeologyKeys);
    const activeIdeologyKeys = unique([
      ...group._base_ideology_keys.filter((key) => !removed.has(key)),
      ...runtime.addedIdeologyKeys,
    ]);
    return {
      id: `country_interest_group:${context.tag}:${group.key}`,
      key: group.key,
      name_zh: group.name_zh,
      display_name: {
        key: runtime.displayNameKey,
        name_zh: context.locName(runtime.displayNameKey),
        is_flavored: runtime.displayNameKey !== group.key,
      },
      color: group.color,
      texture: group.texture,
      base_traits: group._base_trait_keys.map((key) => interestGroupTraitRef(key, context.interestGroupTraits)),
      active_traits: activeTraitKeys.map((key) => interestGroupTraitRef(key, context.interestGroupTraits)),
      traits_source: runtime.traitKeys.length ? "风味规则" : "基础默认",
      base_ideologies: group._base_ideology_keys.map((key) => ideologyRef(key, context.ideologies)),
      active_ideologies: activeIdeologyKeys.map((key) => ideologyRef(key, context.ideologies)),
      added_ideologies: unique(runtime.addedIdeologyKeys).map((key) => ideologyRef(key, context.ideologies)),
      removed_ideologies: unique(runtime.removedIdeologyKeys).map((key) => ideologyRef(key, context.ideologies)),
      character_ideologies: group._character_ideology_keys.map((key) => ideologyRef(key, context.ideologies)),
      applied_rules: appliedInterestGroupRules(runtime.effects),
      source_file: group.source_file,
    };
  });
}

function ideologyCoverageRows(ideologies, countryRows, interestGroups, context) {
  const eligibleCountries = countryRows.filter((row) => row.country_type !== "decentralized");
  const coverage = new Map();
  for (const country of eligibleCountries) {
    const present = new Set();
    for (const group of countryInterestGroupFlavors(interestGroups, {
      tag: country.tag,
      country_type: country.country_type,
      primaryCultureKeys: splitJoined(country.primary_cultures),
      religion: country.religion,
      ...context,
    })) {
      for (const ideology of group.active_ideologies || []) present.add(ideology.key);
    }
    for (const key of present) coverage.set(key, (coverage.get(key) || 0) + 1);
  }
  return [...ideologies.values()].map((ideology) => ({
    ...ideology,
    country_coverage_count: coverage.get(ideology.key) || 0,
    country_coverage_total: eligibleCountries.length,
    is_universal: eligibleCountries.length > 0 && coverage.get(ideology.key) === eligibleCountries.length,
  }));
}

function executeInterestGroupEffects(value, context, runtime, conditions) {
  const node = asNode(value);
  if (!node) return;
  for (let index = 0; index < node.assignments.length; index += 1) {
    const assignment = node.assignments[index];
    if (assignment.key === "limit") continue;
    if (assignment.key === "if") {
      const chain = [assignment];
      let cursor = index + 1;
      while (cursor < node.assignments.length && (node.assignments[cursor].key === "else_if" || node.assignments[cursor].key === "else")) {
        chain.push(node.assignments[cursor]);
        cursor += 1;
      }
      executeInterestGroupBranchChain(chain, context, runtime, conditions);
      index = cursor - 1;
      continue;
    }
    if (assignment.key === "else_if" || assignment.key === "else") continue;
    applyInterestGroupEffect(assignment, context, runtime, conditions);
    executeInterestGroupEffects(assignment.value, context, runtime, conditions);
  }
}

function executeInterestGroupBranchChain(chain, context, runtime, conditions) {
  let matched = false;
  let blockedByUnknown = false;
  for (const branch of chain) {
    const branchNode = asNode(branch.value);
    const limit = branch.key === "else" ? null : (branchNode ? firstValue(branchNode, "limit") : null);
    const result = branch.key === "else"
      ? (!matched && !blockedByUnknown ? "true" : "false")
      : evaluateInterestGroupCondition(limit, context);
    if (result === "unknown") {
      blockedByUnknown = true;
      continue;
    }
    if (result !== "true" || matched) continue;
    const condition = branch.key === "else"
      ? { summary_zh: "其他情况", raw: "else" }
      : summarizeInterestGroupCondition(limit, context);
    executeInterestGroupEffects(branch.value, context, runtime, [...conditions, condition]);
    matched = true;
  }
}

function applyInterestGroupEffect(assignment, context, runtime, conditions) {
  const scalar = stripPrefix(scalarFromValue(assignment.value));
  if (!scalar) return;
    if (assignment.key === "set_interest_group_name") {
    runtime.displayNameKey = scalar;
    runtime.effects.push(interestGroupEffect("set_name", scalar, context.locName(scalar), sourceConditions(conditions, runtime.sourceFile)));
    return;
  }
  if (assignment.key === "set_ig_trait") {
    runtime.traitKeys.push(scalar);
    runtime.effects.push(interestGroupEffect("set_trait", scalar, context.locName(scalar), sourceConditions(conditions, runtime.sourceFile)));
    return;
  }
  if (assignment.key === "add_ideology") {
    runtime.addedIdeologyKeys.push(scalar);
    runtime.effects.push(interestGroupEffect("add_ideology", scalar, context.locName(scalar), sourceConditions(conditions, runtime.sourceFile)));
    return;
  }
  if (assignment.key === "remove_ideology") {
    runtime.removedIdeologyKeys.push(scalar);
    runtime.effects.push(interestGroupEffect("remove_ideology", scalar, context.locName(scalar), sourceConditions(conditions, runtime.sourceFile)));
  }
}

function sourceConditions(conditions, sourceFile) {
  return (conditions || []).map((condition) => ({
    ...condition,
    source_file: condition.source_file || sourceFile || "",
  }));
}

function interestGroupEffect(type, key, nameZh, conditions) {
  const conditionSummary = combineConditionSummaries(conditions);
  return {
    type,
    key,
    name_zh: nameZh || key,
    condition_summary_zh: conditionSummary.summary_zh,
    condition_raw: conditionSummary.raw,
    source_file: conditions.find((condition) => condition.source_file)?.source_file || "",
  };
}

function appliedInterestGroupRules(effects) {
  const groups = new Map();
  for (const effect of effects || []) {
    const key = `${effect.condition_summary_zh}\n${effect.condition_raw}`;
    if (!groups.has(key)) {
      groups.set(key, {
        condition_summary_zh: effect.condition_summary_zh,
        condition_raw: effect.condition_raw,
        source_file: effect.source_file || "",
        names: [],
        traits: [],
        added_ideologies: [],
        removed_ideologies: [],
      });
    }
    const group = groups.get(key);
    const ref = {
      key: effect.key,
      name_zh: effect.name_zh,
    };
    if (effect.type === "set_name") group.names.push(ref);
    if (effect.type === "set_trait") group.traits.push(ref);
    if (effect.type === "add_ideology") group.added_ideologies.push(ref);
    if (effect.type === "remove_ideology") group.removed_ideologies.push(ref);
  }
  return [...groups.values()].map((rule) => ({
    ...rule,
    names: uniqueRefs(rule.names),
    traits: uniqueRefs(rule.traits),
    added_ideologies: uniqueRefs(rule.added_ideologies),
    removed_ideologies: uniqueRefs(rule.removed_ideologies),
  }));
}

function uniqueRefs(items) {
  const seen = new Set();
  const result = [];
  for (const item of items || []) {
    if (!item?.key || seen.has(item.key)) continue;
    seen.add(item.key);
    result.push(item);
  }
  return result;
}

function evaluateInterestGroupCondition(value, context) {
  if (value === undefined || value === null) return "unknown";
  if (typeof value === "string") return "unknown";
  const node = asNode(value);
  if (!node) return "unknown";
  const results = [];
  for (const item of node.items) results.push(evaluateInterestGroupCondition(item, context));
  for (const assignment of node.assignments) {
    results.push(evaluateConditionAssignment(assignment, context));
  }
  return combineAndResults(results);
}

function evaluateConditionAssignment(assignment, context) {
  const key = assignment.key;
  const value = assignment.value;
  if (key === "always") return scalarFromValue(value) === "yes" ? "true" : "false";
  if (key === "OR") return combineOrResults(conditionChildResults(value, context));
  if (key === "AND") return combineAndResults(conditionChildResults(value, context));
  if (key === "NOT") return invertConditionResult(evaluateInterestGroupCondition(value, context));
  if (key === "NOR") return invertConditionResult(combineOrResults(conditionChildResults(value, context)));
  if (key === "owner" || key === "ROOT" || key === "root" || key === "scope:actor") {
    return evaluateInterestGroupCondition(value, context);
  }
  const countryMatch = key.match(/^c:([A-Z0-9]{3})$/);
  if (countryMatch) {
    const result = countryMatch[1] === context.tag ? "true" : "false";
    return assignment.op === "!=" ? invertConditionResult(result) : result;
  }
  if (key === "country_has_primary_culture") {
    const cultureKey = stripPrefix(scalarFromValue(value));
    const result = context.primaryCultureKeys.includes(cultureKey) ? "true" : "false";
    return assignment.op === "!=" ? invertConditionResult(result) : result;
  }
  if (key === "country_has_state_religion") {
    const religionKey = stripPrefix(scalarFromValue(value));
    const result = context.religion === religionKey ? "true" : "false";
    return assignment.op === "!=" ? invertConditionResult(result) : result;
  }
  if (key === "exists") {
    const countryTag = tagFromCountryValue(value);
    if (!countryTag) return "unknown";
    const result = context.existingAtStartTags?.has(countryTag) ? "true" : "false";
    return assignment.op === "!=" ? invertConditionResult(result) : result;
  }
  if (key === "any_primary_culture") {
    const results = context.primaryCultureKeys.map((cultureKey) => evaluateCultureCondition(value, cultureKey, context));
    return combineOrResults(results);
  }
  if (key === "has_discrimination_trait") {
    const traitKey = stripPrefix(scalarFromValue(value));
    const result = context.primaryCultureKeys.some((cultureKey) => cultureHasTrait(cultureKey, traitKey, context)) ? "true" : "false";
    return assignment.op === "!=" ? invertConditionResult(result) : result;
  }
  if (key === "has_discrimination_trait_group") {
    const groupKey = stripPrefix(scalarFromValue(value));
    const result = context.primaryCultureKeys.some((cultureKey) => cultureHasTraitGroup(cultureKey, groupKey, context)) ? "true" : "false";
    return assignment.op === "!=" ? invertConditionResult(result) : result;
  }
  if (key === "has_dlc_feature") return "true";
  return "unknown";
}

function evaluateCultureCondition(value, cultureKey, context) {
  const node = asNode(value);
  if (!node) return "unknown";
  const results = [];
  for (const assignment of node.assignments) {
    const key = assignment.key;
    if (key === "OR") {
      results.push(combineOrResults(cultureConditionChildResults(assignment.value, cultureKey, context)));
    } else if (key === "AND") {
      results.push(combineAndResults(cultureConditionChildResults(assignment.value, cultureKey, context)));
    } else if (key === "NOT") {
      results.push(invertConditionResult(evaluateCultureCondition(assignment.value, cultureKey, context)));
    } else if (key === "NOR") {
      results.push(invertConditionResult(combineOrResults(cultureConditionChildResults(assignment.value, cultureKey, context))));
    } else if (key.startsWith("cu:")) {
      const targetCulture = stripPrefix(key);
      const result = cultureKey === targetCulture ? "true" : "false";
      results.push(assignment.op === "!=" ? invertConditionResult(result) : result);
    } else if (key === "has_discrimination_trait") {
      const traitKey = stripPrefix(scalarFromValue(assignment.value));
      const result = cultureHasTrait(cultureKey, traitKey, context) ? "true" : "false";
      results.push(assignment.op === "!=" ? invertConditionResult(result) : result);
    } else if (key === "has_discrimination_trait_group") {
      const groupKey = stripPrefix(scalarFromValue(assignment.value));
      const result = cultureHasTraitGroup(cultureKey, groupKey, context) ? "true" : "false";
      results.push(assignment.op === "!=" ? invertConditionResult(result) : result);
    } else {
      results.push("unknown");
    }
  }
  return combineAndResults(results);
}

function conditionChildResults(value, context) {
  const node = asNode(value);
  if (!node) return ["unknown"];
  return [
    ...node.items.map((item) => evaluateInterestGroupCondition(item, context)),
    ...node.assignments.map((assignment) => evaluateConditionAssignment(assignment, context)),
  ];
}

function cultureConditionChildResults(value, cultureKey, context) {
  const node = asNode(value);
  if (!node) return ["unknown"];
  return [
    ...node.items.map(() => "unknown"),
    ...node.assignments.map((assignment) => {
      const wrapper = { assignments: [assignment], items: [] };
      return evaluateCultureCondition(wrapper, cultureKey, context);
    }),
  ];
}

function combineAndResults(results) {
  if (!results.length) return "true";
  if (results.some((result) => result === "false")) return "false";
  if (results.some((result) => result === "unknown")) return "unknown";
  return "true";
}

function combineOrResults(results) {
  if (!results.length) return "unknown";
  if (results.some((result) => result === "true")) return "true";
  if (results.some((result) => result === "unknown")) return "unknown";
  return "false";
}

function invertConditionResult(result) {
  if (result === "true") return "false";
  if (result === "false") return "true";
  return "unknown";
}

function cultureHasTrait(cultureKey, traitKey, context) {
  if (!cultureKey || !traitKey) return false;
  const culture = context.cultures.get(cultureKey);
  return (culture?.trait_keys || []).includes(traitKey);
}

function cultureHasTraitGroup(cultureKey, groupKey, context) {
  if (!cultureKey || !groupKey) return false;
  const culture = context.cultures.get(cultureKey);
  return (culture?.trait_keys || []).some((traitKey) => context.cultureTraits.get(traitKey)?.group_key === groupKey);
}

function tagFromCountryValue(value) {
  const scalar = scalarFromValue(value);
  const match = scalar.match(/^c:([A-Z0-9]{3})$/);
  return match ? match[1] : "";
}

function summarizeInterestGroupCondition(value, context) {
  const raw = stringifyScriptValue(value);
  const tags = [...collectTagRefs(value)].sort();
  const cultures = [...collectCultureRefs(value)].sort();
  const religions = [...collectReligionRefs(value)].sort();
  const traitKeys = [...collectAssignedScalarValues(value, "has_discrimination_trait")].sort();
  const traitGroupKeys = [...collectAssignedScalarValues(value, "has_discrimination_trait_group")].sort();
  const dlcKeys = [...collectAssignedScalarValues(value, "has_dlc_feature")].sort();
  const technologyKeys = [...collectTechnologyRefs(value)].sort();
  const variableKeys = [...collectVariableRefs(value)].sort();
  const parts = [];
  if (tags.length) parts.push(`国家：${tags.map((tag) => context.locName(tag)).join("、")}`);
  if (cultures.length) parts.push(`主流文化：${cultures.map((key) => context.locName(key)).join("、")}`);
  if (religions.length) parts.push(`国教：${religions.map((key) => context.locName(key)).join("、")}`);
  if (traitKeys.length) parts.push(`文化特质：${traitKeys.map((key) => context.locName(key)).join("、")}`);
  if (traitGroupKeys.length) parts.push(`文化特质组：${traitGroupKeys.map((key) => context.locName(key)).join("、")}`);
  if (dlcKeys.length) parts.push(`资料片条件：${dlcKeys.join("、")}`);
  if (technologyKeys.length) parts.push(`科技：${technologyKeys.map((key) => context.locName(key)).join("、")}`);
  if (variableKeys.length) parts.push(`变量：${variableKeys.join("、")}`);
  return {
    summary_zh: parts.length ? parts.join("；") : "脚本条件",
    raw,
  };
}

function combineConditionSummaries(conditions) {
  const summaries = unique((conditions || []).map((condition) => condition.summary_zh).filter(Boolean));
  const rawParts = unique((conditions || []).map((condition) => condition.raw).filter(Boolean));
  return {
    summary_zh: summaries.length ? summaries.join("；") : "默认",
    raw: rawParts.join("\n"),
  };
}

function cultureTraitTypeZh(type) {
  if (type === "heritage") return "传承";
  if (type === "language") return "语言";
  if (type === "tradition") return "传统";
  return type || "";
}

function modifierRef(key, value, loc) {
  const rawValue = stripQuotes(scalarFromValue(value));
  const numericValue = toNumberOrNull(rawValue);
  const nameZh = cleanLocalizationText(locName(loc, key), loc);
  const descZh = loc.has(`${key}_desc`) ? cleanLocalizationText(locName(loc, `${key}_desc`), loc) : "";
  const valueZh = formatModifierValue(key, numericValue, rawValue);
  return {
    key,
    name_zh: nameZh,
    desc_zh: descZh,
    value: numericValue,
    value_raw: rawValue,
    value_zh: valueZh,
    summary_zh: `${nameZh}${valueZh ? ` ${valueZh}` : ""}`,
    category: modifierCategory(key),
  };
}

function inferStateTraitCategories(traitKey, icon, modifiers) {
  const categories = [];
  for (const modifier of modifiers || []) {
    categories.push(modifier.category);
  }
  const iconName = path.basename(icon || "", ".dds");
  if (/natural_harbors|fjords/.test(iconName)) categories.push(traitCategory("port", "港口"));
  if (/river|waterfall/.test(iconName)) categories.push(traitCategory("river", "河流"));
  if (/resources_/.test(iconName)) categories.push(traitCategory("resource", "资源"));
  if (/good_soils|poor_soils|vineyard|great_plains/.test(iconName)) categories.push(traitCategory("agriculture", "农业"));
  if (/malaria/.test(iconName) || /malaria/.test(traitKey)) categories.push(traitCategory("disease_colony", "疾病/殖民"));
  if (/mountain|dry_climate|tropical_climate|cold_climate|swamp/.test(iconName)) categories.push(traitCategory("terrain_climate", "地形/气候"));
  return uniqueByCategory(categories);
}

function modifierCategory(key) {
  if (key === "state_market_access_price_impact") return traitCategory("mapi", "市场价格影响");
  if (/infrastructure|trade_capacity|land_trade_capacity|market_access/.test(key)) return traitCategory("infrastructure_market", "基础设施/市场");
  if (/mortality|colony|colonization/.test(key)) return traitCategory("disease_colony", "疾病/殖民");
  if (/agriculture|plantation|farm|ranch|vineyard|dye|cotton|silk|sugar|banana|opium|tobacco|maize|wheat|rye|rice/.test(key)) {
    return traitCategory("agriculture", "农业");
  }
  if (/mine|mining|coal|iron|lead|sulfur|gold|oil|logging|rubber|fishing|whaling|resources/.test(key)) {
    return traitCategory("resource", "资源");
  }
  if (/port|shipyard|naval|convoy/.test(key)) return traitCategory("port", "港口/造船");
  if (/building_|building_group_|goods_output|goods_input/.test(key)) return traitCategory("building", "建筑");
  return traitCategory("state", "州修正");
}

function traitCategory(key, nameZh) {
  return {
    key,
    name_zh: nameZh,
  };
}

function uniqueByCategory(categories) {
  const seen = new Set();
  const result = [];
  for (const category of categories || []) {
    if (!category?.key || seen.has(category.key)) continue;
    seen.add(category.key);
    result.push(category);
  }
  return result;
}

function formatModifierValue(key, numericValue, rawValue) {
  if (!Number.isFinite(numericValue)) return rawValue === "yes" ? "" : rawValue || "";
  const sign = numericValue > 0 ? "+" : "";
  if (isPercentModifierKey(key)) {
    return `${sign}${formatNumber(numericValue * 100)}%`;
  }
  return `${sign}${formatNumber(numericValue)}`;
}

function formatNumber(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(2))).replace(/\.0+$/, "");
}

function isPercentModifierKey(key) {
  return key === "state_market_access_price_impact"
    || key.endsWith("_mult")
    || key.includes("_throughput_add")
    || key.includes("_efficiency_add")
    || key.includes("_speed_add")
    || key.includes("_rate_add");
}

function cleanLocalizationText(text, loc, depth = 0) {
  if (!text) return "";
  let result = String(text);
  if (depth > 6) return result;
  result = result.replace(/\[GetDefine\(\s*['"]NPops['"]\s*,\s*['"]INDIVIDUALS_PER_POP_INFRASTRUCTURE['"]\s*\)\|vK\]/g, "100K");
  result = result.replace(/\[Nbsp\]/g, " ");
  result = result.replace(/\[Concept\('([^']+)'\s*,\s*'([^']+)'\)\]/g, (_match, conceptKey, display) => {
    const displayKey = display.startsWith("$") && display.endsWith("$") ? display.slice(1, -1) : display;
    return cleanLocalizationText(loc.get(displayKey) || loc.get(conceptKey) || displayKey || conceptKey, loc, depth + 1);
  });
  result = result.replace(/\[(concept_[A-Za-z0-9_]+)\]/g, (_match, conceptKey) => (
    cleanLocalizationText(loc.get(conceptKey) || conceptKey, loc, depth + 1)
  ));
  result = result.replace(/\$([A-Za-z0-9_:.]+)(?:\|[^$]+)?\$/g, (_match, key) => (
    cleanLocalizationText(loc.get(key) || key, loc, depth + 1)
  ));
  result = result.replace(/\[GetInterestGroupVariant\('([^']+)'\s*,\s*GetPlayer\)\.GetNameWithCountryVariant\]/g, (_match, key) => (
    cleanLocalizationText(locName(loc, key), loc, depth + 1)
  ));
  result = result.replace(/\[Get(?:InstitutionType|PopType|CombatUnitGroup|CombatUnitType|DiplomaticActionType|BuildingType|LawType)\('([^']+)'\)\.GetName\]/g, (_match, key) => (
    cleanLocalizationText(locName(loc, key), loc, depth + 1)
  ));
  result = result.replace(/@[A-Za-z0-9_]+!/g, "");
  result = result.replace(/#!/g, "").replace(/#(?:[A-Za-z0-9_]+)?\s?/g, "");
  return result;
}

function collectDynamicStateNameAssignments(value, triggerRaw, out) {
  const node = asNode(value);
  if (!node) return;
  for (const assignment of node.assignments) {
    if (assignment.key === "set_state_name") {
      out.push({
        name_key: scalarFromValue(assignment.value),
        trigger_raw: triggerRaw,
      });
      continue;
    }
    if (assignment.key === "if" || assignment.key === "else_if" || assignment.key === "else") {
      const branchNode = asNode(assignment.value);
      const limitValue = branchNode ? firstValue(branchNode, "limit") : null;
      const nextTrigger = limitValue
        ? stringifyScriptValue(limitValue)
        : assignment.key === "else"
          ? "else"
          : stringifyScriptValue(assignment.value);
      collectDynamicStateNameAssignments(assignment.value, nextTrigger, out);
      continue;
    }
    collectDynamicStateNameAssignments(assignment.value, triggerRaw, out);
  }
}

function stateKeyFromDynamicStateNameKey(nameKey, stateKeys) {
  return stateKeys.find((stateKey) => nameKey === stateKey || nameKey.startsWith(`${stateKey}_`)) || "";
}

function uniqueDynamicStateNameVariants(variants) {
  const seen = new Set();
  return (variants || []).filter((variant) => {
    const identity = `${variant.state_key}|${variant.name_key}|${variant.trigger_raw}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  }).sort((a, b) => a.order - b.order || a.name_key.localeCompare(b.name_key));
}

function pushMapSet(map, key, value) {
  if (!key) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

function resolveFormationStateRegions(rule, stateRegionKeysByCulture, geographicRegions) {
  if (!rule) return [];
  const result = new Set(rule.states || []);
  const region = geographicRegions.get(rule.geographic_region);
  for (const stateKey of region?.state_regions || []) {
    result.add(stateKey);
  }
  if (rule.use_culture_states) {
    for (const cultureKey of rule.candidate_cultures || rule.required_cultures || []) {
      for (const stateKey of stateRegionKeysByCulture.get(cultureKey) || []) {
        result.add(stateKey);
      }
    }
  }
  return [...result];
}

const geographicRegionGroupLabels = {
  ignored_current_strategic: "当前战略区域",
  old_strategic: "旧战略区域",
  natural: "自然地理区域",
  history: "历史地理区域",
  culture: "文化地理区域",
  world: "世界与大区",
  economy: "经济地理区域",
  pending: "暂置",
};

const naturalGeographicRegionKeys = new Set([
  "geographic_region_alpide_belt",
  "geographic_region_amazon",
  "geographic_region_great_rift_valley",
  "geographic_region_krakatoa_tsunami_zone",
  "geographic_region_polar_seas",
  "geographic_region_ring_of_fire",
  "geographic_region_tropical_seas",
  "geographic_region_wet_process_coffee_region",
  "geographic_region_zambezi_basin",
]);

const historyGeographicRegionKeys = new Set([
  "geographic_region_colonial_la_plata",
  "geographic_region_colonial_new_grenada",
  "geographic_region_colonial_new_spain",
  "geographic_region_colonial_peru",
  "geographic_region_french_natural_borders",
  "geographic_region_german_confederation",
  "geographic_region_historic_byzantium",
]);

const cultureGeographicRegionKeys = new Set([
  "geographic_region_afghanistan",
  "geographic_region_andean_federation",
  "geographic_region_angola",
  "geographic_region_aragon",
  "geographic_region_australia",
  "geographic_region_bolivia",
  "geographic_region_burma",
  "geographic_region_castile",
  "geographic_region_china",
  "geographic_region_chorasmia",
  "geographic_region_ezochi",
  "geographic_region_france",
  "geographic_region_greater_afghanistan",
  "geographic_region_greater_bulgaria",
  "geographic_region_greater_canada",
  "geographic_region_greater_croatia",
  "geographic_region_greater_germany",
  "geographic_region_greater_khorasan",
  "geographic_region_greater_romania",
  "geographic_region_han_homelands",
  "geographic_region_home_islands",
  "geographic_region_honshu",
  "geographic_region_hungary",
  "geographic_region_iceland",
  "geographic_region_india",
  "geographic_region_japan",
  "geographic_region_korea",
  "geographic_region_lesser_germany",
  "geographic_region_megali_greece",
  "geographic_region_mozambique",
  "geographic_region_new_zealand",
  "geographic_region_north_africa_egypt",
  "geographic_region_north_andes",
  "geographic_region_northern_mexico",
  "geographic_region_peru",
  "geographic_region_philippines",
  "geographic_region_scandinavia",
  "geographic_region_south_africa",
  "geographic_region_southern_cone",
  "geographic_region_transoxiana",
  "geographic_region_turkestan",
  "geographic_region_yugoslavia",
]);

const worldGeographicRegionKeys = new Set([
  "geographic_region_africa",
  "geographic_region_americas",
  "geographic_region_asia",
  "geographic_region_australasia",
  "geographic_region_east_asia",
  "geographic_region_europe",
  "geographic_region_great_game_region",
  "geographic_region_indian_frontier",
  "geographic_region_latin_america",
  "geographic_region_middle_east",
  "geographic_region_new_world",
  "geographic_region_north_america",
  "geographic_region_old_world",
  "geographic_region_south_america",
  "geographic_region_south_east_asia",
  "geographic_region_subsaharan_africa",
]);

const economyGeographicRegionKeys = new Set([
  "geographic_region_allahabad_bombay_line",
  "geographic_region_bombay_madras_line",
  "geographic_region_delhi_calcutta_line",
  "geographic_region_gujarat_bombay_line",
]);

function geographicRegionGroupKey(region) {
  const sourceName = path.basename(region.source_file || "");
  if (sourceName === "06_new_strategic_regions.txt") return "ignored_current_strategic";
  if (sourceName === "06_old_strategic_regions.txt") return "old_strategic";
  if (naturalGeographicRegionKeys.has(region.key)) return "natural";
  if (historyGeographicRegionKeys.has(region.key)) return "history";
  if (cultureGeographicRegionKeys.has(region.key)) return "culture";
  if (worldGeographicRegionKeys.has(region.key)) return "world";
  if (economyGeographicRegionKeys.has(region.key)) return "economy";
  return "pending";
}

function oldStrategicRegionKey(region) {
  if (String(region.name_key || "").startsWith("region_")) return region.name_key;
  const key = String(region.key || "").replace(/^geographic_region_/, "");
  return key.endsWith("_old") ? `region_${key.slice(0, -4)}` : "";
}

function geographicRegionDisplayName(region, groupKey) {
  const baseName = region.name_zh || region.key;
  if (groupKey === "old_strategic") return `${baseName}(旧战略区域)`;
  return baseName;
}

function stateRegionSetKey(keys) {
  return [...new Set(keys || [])].sort().join("|");
}

function currentStrategicRegionKeysByStateSet(strategicRegionByKey) {
  const result = new Map();
  for (const strategicRegion of strategicRegionByKey.values()) {
    const setKey = stateRegionSetKey((strategicRegion.states || []).map((stateRegion) => stateRegion.key));
    if (!setKey) continue;
    if (!result.has(setKey)) result.set(setKey, []);
    result.get(setKey).push(strategicRegion);
  }
  return result;
}

function buildGeographicRegionRows(geographicRegions, stateRegionByKey, strategicRegionByKey) {
  const strategicRegionsByStateSet = currentStrategicRegionKeysByStateSet(strategicRegionByKey);
  return [...geographicRegions.values()]
    .sort((a, b) => (a.name_zh || a.key).localeCompare(b.name_zh || b.key, "zh-Hans-CN") || a.key.localeCompare(b.key))
    .map((region) => {
      const stateKeys = sortStateRegionKeys(region.state_regions || [], stateRegionByKey);
      const strategicKeys = sortStrategicRegionKeys(region.strategic_regions || [], strategicRegionByKey);
      const matchingStrategicRegions = strategicRegionsByStateSet.get(stateRegionSetKey(stateKeys)) || [];
      const groupKey = geographicRegionGroupKey(region);
      const isOldStrategicRegion = groupKey === "old_strategic";
      const nameZh = region.name_zh || region.key;
      return {
        id: region.id || `geographic_region:${region.key}`,
        key: region.key,
        name_zh: nameZh,
        display_name_zh: geographicRegionDisplayName(region, groupKey),
        geographic_region_group: groupKey,
        geographic_region_group_zh: geographicRegionGroupLabels[groupKey] || groupKey,
        is_old_strategic_region: isOldStrategicRegion,
        old_strategic_region_key: isOldStrategicRegion ? oldStrategicRegionKey(region) : "",
        is_current_strategic_region: matchingStrategicRegions.length > 0 && path.basename(region.source_file || "") === "06_new_strategic_regions.txt",
        matching_strategic_regions: matchingStrategicRegions.map((strategicRegion) => strategicRegionRef(strategicRegion.key, strategicRegionByKey)),
        state_regions: stateKeys.map((key) => stateRegionRef(key, stateRegionByKey)),
        strategic_regions: strategicKeys.map((key) => strategicRegionRef(key, strategicRegionByKey)),
        state_region_count: stateKeys.length,
        source_file: region.source_file || "",
      };
    });
}

function writeDatabase(dir, data) {
  const {
    version,
    datasetName,
    gamePath,
    gameDir,
    modPath,
    modContentRoot,
    loc,
    countryRows,
    definitions,
    cultures,
    cultureTraits,
    cultureTraitGroups,
    stateRegionRows,
    strategicRegionRows,
    companies,
    companyCharterTypes,
    interestGroups,
    religions,
    interestGroupTraits,
    ideologies,
    lawGroups,
    laws,
    technologies,
    technologyEras,
    achievements,
    geographicRegions,
    cultureRows,
    cultureTraitRows,
    cultureTraitGroupRows,
    dynamicNameVariants,
    dynamicMapColorRules,
    formableRules,
    formables,
    releasables,
    economy,
    popNeeds,
    buyPackages,
    localeCatalogs,
  } = data;
  const stateRegionByKey = new Map(stateRegionRows.map((stateRegion) => [stateRegion.key, stateRegion]));
  const strategicRegionByKey = new Map(strategicRegionRows.map((strategicRegion) => [strategicRegion.key, strategicRegion]));
  const geographicRegionRows = buildGeographicRegionRows(geographicRegions, stateRegionByKey, strategicRegionByKey);
  const stateRegionKeysByCulture = new Map();
  const strategicRegionKeysByCulture = new Map();
  for (const stateRegion of stateRegionRows) {
    for (const cultureRef of stateRegion.homeland_cultures || []) {
      pushMapSet(stateRegionKeysByCulture, cultureRef.key, stateRegion.key);
      for (const strategicRegion of stateRegion.strategic_regions || []) {
        pushMapSet(strategicRegionKeysByCulture, cultureRef.key, strategicRegion.key);
      }
    }
  }
  const existingAtStartTags = new Set(countryRows
    .filter((row) => row.exists_at_start === "是")
    .map((row) => row.tag));
  const countries = countryRows.map((row) => {
    const def = definitions.get(row.tag);
    const formable = formableRules.get(row.tag);
    const primaryCultureKeys = splitJoined(row.primary_cultures);
    const primaryCultureTraitKeys = unique(primaryCultureKeys.flatMap((cultureKey) => cultures.get(cultureKey)?.trait_keys || [])).sort();
    const primaryCultureTraitGroupKeys = unique(primaryCultureTraitKeys.map((traitKey) => cultureTraits.get(traitKey)?.group_key).filter(Boolean)).sort();
    const primaryCultureHomelandStateKeys = sortStateRegionKeys(primaryCultureKeys.flatMap((cultureKey) => [...(stateRegionKeysByCulture.get(cultureKey) || [])]), stateRegionByKey);
    const primaryCultureHomelandStrategicRegionKeys = sortStrategicRegionKeys(primaryCultureKeys.flatMap((cultureKey) => [...(strategicRegionKeysByCulture.get(cultureKey) || [])]), strategicRegionByKey);
    const formationStateRegionKeys = sortStateRegionKeys(resolveFormationStateRegions(formable, stateRegionKeysByCulture, geographicRegions), stateRegionByKey);
    const formationStrategicRegionKeys = unique(formationStateRegionKeys.flatMap((stateKey) => (
      stateRegionByKey.get(stateKey)?.strategic_regions || []
    ).map((region) => region.key)));
    const locationStateRegionKeys = sortStateRegionKeys([
      ...splitJoined(row.starting_states),
      ...splitJoined(row.release_states),
      ...formationStateRegionKeys,
      row.capital,
    ], stateRegionByKey);
    const locationStrategicRegionKeys = sortStrategicRegionKeys(locationStateRegionKeys.flatMap((stateKey) => (
      stateRegionByKey.get(stateKey)?.strategic_regions || []
    ).map((region) => region.key)), strategicRegionByKey);
    const specialMechanic = specialCountryMechanics.get(row.tag) || "";
    return {
      id: `country:${row.tag}`,
      tag: row.tag,
      name: {
        zh: row.name_zh,
      },
      status: {
        exists_at_start: row.exists_at_start === "是",
        has_history_country_file: row.has_history_country_file === "是",
        is_releasable: row.is_releasable === "是",
        is_formable: row.is_formable === "是",
        is_major_formable: row.is_major_formable === "是",
      },
      special_mechanic: {
        is_special: Boolean(specialMechanic),
        name_zh: specialMechanic,
        tags: specialMechanic ? ["特殊"] : [],
      },
      classification: {
        country_type: row.country_type,
        country_type_zh: row.country_type_zh,
        tier: row.tier,
        tier_zh: row.tier_zh,
        tier_prestige: toNumberOrNull(row.tier_prestige),
      },
      color: {
        rgb: def?.color?.rgb || null,
        hex: row.color_hex,
        source: "common/country_definitions",
      },
      unit_colors: {
        primary: row.primary_unit_color,
        secondary: row.secondary_unit_color,
        tertiary: row.tertiary_unit_color,
      },
      primary_cultures: primaryCultureKeys.map((culture, index) => ({
        id: `culture:${culture}`,
        key: culture,
        name_zh: splitJoined(row.primary_cultures_zh)[index] || culture,
      })),
      primary_culture_traits: primaryCultureTraitKeys.map((traitKey) => cultureTraitRef(traitKey, cultureTraits)),
      primary_culture_trait_groups: primaryCultureTraitGroupKeys.map((groupKey) => cultureTraitGroupRef(groupKey, cultureTraitGroups)),
      primary_culture_homeland_state_regions: primaryCultureHomelandStateKeys.map((key) => stateRegionRef(key, stateRegionByKey)),
      primary_culture_homeland_strategic_regions: primaryCultureHomelandStrategicRegionKeys.map((key) => strategicRegionRef(key, strategicRegionByKey)),
      formation_state_regions: formationStateRegionKeys.map((key) => stateRegionRef(key, stateRegionByKey)),
      formation_strategic_regions: sortStrategicRegionKeys(formationStrategicRegionKeys, strategicRegionByKey).map((key) => strategicRegionRef(key, strategicRegionByKey)),
      location_state_regions: locationStateRegionKeys.map((key) => stateRegionRef(key, stateRegionByKey)),
      location_strategic_regions: locationStrategicRegionKeys.map((key) => strategicRegionRef(key, strategicRegionByKey)),
      religion: {
        id: row.religion ? `religion:${row.religion}` : "",
        key: row.religion,
        name_zh: row.religion_zh,
        source: row.religion_source,
      },
      capital: {
        id: row.capital ? `state_region:${row.capital}` : "",
        key: row.capital,
        name_zh: row.capital_zh,
      },
      starting_states: sortStateRegionKeys(splitJoined(row.starting_states), stateRegionByKey).map((state) => ({
        id: `state_region:${state}`,
        key: state,
      })),
      starting_subject: {
        overlord_tag: row.starting_overlord_tag,
        overlord_name_zh: row.starting_overlord_tag ? locName(loc, row.starting_overlord_tag) : "",
        type: row.starting_subject_type,
        uses_overlord_color: row.starting_subject_uses_overlord_color === "是",
      },
      starting_technology_tier: row.starting_technology_tier ? Number(row.starting_technology_tier) : null,
      starting_technology_template: row.starting_technology_template || "",
      starting_technology_eras: splitJoined(row.starting_technology_eras),
      starting_technology_template_technologies: splitJoined(row.starting_technology_template_keys).map((key) => technologyRef(key, technologies, loc)),
      starting_technologies: splitJoined(row.starting_technology_keys).map((key) => technologyRef(key, technologies, loc)),
       starting_laws: row.starting_laws || splitJoined(row.starting_law_keys).map((key) => lawRef(key, laws, loc)),
      starting_diplomacy: (row.starting_diplomacy || []).map((item) => ({
        ...item,
        target: countryKeyRef(item.target_tag, loc),
      })),
      formation: {
        required_cultures: splitJoined(row.formation_required_cultures).map((culture, index) => ({
          id: `culture:${culture}`,
          key: culture,
          name_zh: splitJoined(row.formation_required_cultures_zh)[index] || culture,
        })),
        states: sortStateRegionKeys(splitJoined(row.formation_states), stateRegionByKey).map((state) => ({
          id: `state_region:${state}`,
          key: state,
        })),
        region: row.formation_region,
      },
      release: {
        states: sortStateRegionKeys(splitJoined(row.release_states), stateRegionByKey).map((state) => ({
          id: `state_region:${state}`,
          key: state,
        })),
      },
      interest_groups: countryInterestGroupFlavors(interestGroups, {
        tag: row.tag,
        country_type: row.country_type,
        primaryCultureKeys,
        religion: row.religion,
        cultures,
        cultureTraits,
        interestGroupTraits,
        ideologies,
        existingAtStartTags,
        locName: (key) => locCleanName(loc, key),
      }),
      can_form_by_primary_culture: splitJoined(row.can_form_tags_by_primary_culture).map((tag, index) => ({
        id: `country:${tag}`,
        tag,
        name_zh: splitJoined(row.can_form_names_zh_by_primary_culture)[index] || tag,
      })),
      dynamic_country_name_variant_ids: dynamicNameVariants
        .filter((variant) => variant.country_tag === row.tag)
        .map((variant) => variant.id),
      uses_default_dynamic_country_name_variants: dynamicNameVariants.some((variant) => variant.scope === "DEFAULT"),
      dynamic_map_color_rule_ids: dynamicMapColorRules
        .filter((rule) => splitJoined(rule.referenced_tags).includes(row.tag))
        .map((rule) => rule.id),
      source: {
        definition_file: row.definition_file,
      },
    };
  });
  const religionRows = buildReligionRows(religions, countries, interestGroups, interestGroupTraits, cultureTraits, loc);

  const economyData = economy || {
    buildings: [],
    buildingGroups: [],
    productionMethodGroups: [],
    productionMethods: [],
    goods: [],
    prestigeGoods: [],
    excludedGraphicalBuildings: [],
  };
  const popNeedRows = [...(popNeeds?.values() || [])]
    .sort((left, right) => left.key.localeCompare(right.key, "en"))
    .map((need) => ({
      key: need.key,
      name_zh: need.name_zh,
      default_good_key: need.default_good_key,
      obsession_demand_min: need.obsession_demand_min,
      obsession_demand_mult: need.obsession_demand_mult,
      prestige_goods_demand_increase: need.prestige_goods_demand_increase,
      entries: need.entries,
      source_file: need.source_file,
    }));
  const buyPackageRows = (buyPackages?.packages || []).map((row) => ({ ...row }));
  const popNeedKeys = new Set(popNeedRows.map((need) => need.key));
  for (const row of buyPackageRows) {
    if (!Number.isFinite(row.political_strength)) throw new Error(`wealth_${row.level} is missing political_strength`);
    for (const needKey of Object.keys(row.values || {})) {
      if (!popNeedKeys.has(needKey)) throw new Error(`wealth_${row.level} references missing pop need: ${needKey}`);
    }
  }
  const originalFiles = {
    countries: countries,
    religions: religionRows,
    cultures: cultureRows,
    culture_traits: cultureTraitRows,
    culture_trait_groups: cultureTraitGroupRows,
    state_regions: stateRegionRows,
    strategic_regions: strategicRegionRows,
    geographic_regions: geographicRegionRows,
    companies: companies,
    company_charter_types: companyCharterTypes,
    interest_groups: interestGroups.map(publicInterestGroup),
    interest_group_traits: [...interestGroupTraits.values()],
    ideologies: ideologyCoverageRows(ideologies, countryRows, interestGroups, {
      cultures,
      cultureTraits,
      interestGroupTraits,
      ideologies,
      existingAtStartTags,
      locName: (key) => locCleanName(loc, key),
    }),
    law_groups: [...lawGroups.values()],
    laws: [...laws.values()],
    technologies: technologies,
    technology_eras: technologyEras,
    achievements: achievements,
    dynamic_country_name_variants: dynamicNameVariants,
    dynamic_country_map_color_rules: dynamicMapColorRules,
    formable_countries: formables,
    releasable_countries: releasables,
    buildings: economyData.buildings,
    building_groups: economyData.buildingGroups,
    production_method_groups: economyData.productionMethodGroups,
    production_methods: economyData.productionMethods,
    goods: economyData.goods,
    prestige_goods: economyData.prestigeGoods,
    pop_needs: popNeedRows,
    buy_packages: buyPackageRows,
    excluded_graphical_buildings: economyData.excludedGraphicalBuildings,
  };
  const projections = Object.fromEntries(Object.entries(localeCatalogs || {}).map(([locale, catalog]) => [
    locale,
    localizeProjection(originalFiles, localeCatalogs["zh-Hans"] || {}, catalog, locale),
  ]));
  const split = splitLocalizedTrees(projections);
  const localeFiles = writeLocaleCatalogs(dir, split.catalogs, split.missing);

  const index = {
    schema_version: 1,
    dataset_name: datasetName,
    victoria3_version: version,
    game_path: gamePath,
    mod_path: modPath,
    source_paths: {
      game_data: gameDir,
      mod_data: modContentRoot,
    },
    generated_at: new Date().toISOString(),
    files: {
      countries: "countries.json",
      religions: "religions.json",
      cultures: "cultures.json",
      culture_traits: "culture_traits.json",
      culture_trait_groups: "culture_trait_groups.json",
      state_regions: "state_regions.json",
      strategic_regions: "strategic_regions.json",
      geographic_regions: "geographic_regions.json",
      companies: "companies.json",
      company_charter_types: "company_charter_types.json",
      interest_groups: "interest_groups.json",
      interest_group_traits: "interest_group_traits.json",
      ideologies: "ideologies.json",
      law_groups: "law_groups.json",
      laws: "laws.json",
      technologies: "technologies.json",
      technology_eras: "technology_eras.json",
      achievements: "achievements.json",
      dynamic_country_name_variants: "dynamic_country_name_variants.json",
      dynamic_country_map_color_rules: "dynamic_country_map_color_rules.json",
      formable_countries: "formable_countries.json",
      releasable_countries: "releasable_countries.json",
      buildings: "buildings.json",
      building_groups: "building_groups.json",
      production_method_groups: "production_method_groups.json",
      production_methods: "production_methods.json",
      goods: "goods.json",
      prestige_goods: "prestige_goods.json",
      pop_needs: "pop_needs.json",
      buy_packages: "buy_packages.json",
      excluded_graphical_buildings: "excluded_graphical_buildings.json",
    },
    locales: {
      default: "en",
      supported: ["zh-Hans", "en"],
      files: localeFiles,
    },
    counts: {
      countries: countries.length,
      religions: religionRows.length,
      cultures: cultureRows.length,
      culture_traits: cultureTraitRows.length,
      culture_trait_groups: cultureTraitGroupRows.length,
      state_regions: stateRegionRows.length,
      strategic_regions: strategicRegionRows.length,
      geographic_regions: geographicRegionRows.length,
      companies: companies.length,
      company_charter_types: companyCharterTypes.length,
      interest_groups: interestGroups.length,
      interest_group_traits: interestGroupTraits.size,
      ideologies: ideologies.size,
      law_groups: lawGroups.size,
      laws: laws.size,
      technologies: technologies.length,
      technology_eras: technologyEras.length,
      achievements: achievements.length,
      dynamic_country_name_variants: dynamicNameVariants.length,
      dynamic_country_map_color_rules: dynamicMapColorRules.length,
      formable_countries: formables.length,
      releasable_countries: releasables.length,
      buildings: economyData.buildings.length,
      building_groups: economyData.buildingGroups.length,
      production_method_groups: economyData.productionMethodGroups.length,
      production_methods: economyData.productionMethods.length,
      goods: economyData.goods.length,
      prestige_goods: economyData.prestigeGoods.length,
      pop_needs: popNeedRows.length,
      buy_packages: buyPackageRows.length,
      excluded_graphical_buildings: economyData.excludedGraphicalBuildings.length,
    },
  };

  writeJson(path.join(dir, "index.json"), index);
  for (const [fileKey, value] of Object.entries(split.structure)) {
  writeJson(path.join(dir, index.files[fileKey]), value);
  }
  writeDatabaseReadme(path.join(dir, "README.md"), index);
}

function localizeProjection(value, sourceCatalog, targetCatalog, locale) {
  const keysBySourceText = new Map();
  const targetLoc = new Map(Object.entries(targetCatalog || {}));
  for (const [key, text] of Object.entries(sourceCatalog || {})) {
    if (text && !keysBySourceText.has(text)) keysBySourceText.set(text, key);
  }

  function resolvedLocalizationText(key) {
    if (!key || targetCatalog[key] === undefined) return "";
    return cleanLocalizationText(targetCatalog[key], targetLoc);
  }

  function translate(text, item, field, hasEnglishSource) {
    if (locale === "zh-Hans" || hasEnglishSource) {
      return cleanLocalizationText(text, targetLoc);
    }
    const key = item?.key || item?.tag || String(item?.id || "").split(":").pop();
    const directKey = field === "desc" || field === "description" ? `${key}_desc` : key;
    const directKeys = [
      field === "company_kind" ? `enum.companyKind.${item?.company_kind}` : "",
      field === "prestige_goods_kind" ? `enum.prestigeGoodsKind.${item?.prestige_goods_kind}` : "",
      field === "dlc_name" ? `enum.companyDlc.${item?.dlc_key}` : "",
      field === "category" && item?.company_kind ? `company_category_${item?.category}` : "",
      directKey,
    ].filter(Boolean);
    for (const directKey of directKeys) {
      const translated = resolvedLocalizationText(directKey);
      if (translated) return translated;
    }
    const sourceKey = keysBySourceText.get(text);
    return sourceKey ? resolvedLocalizationText(sourceKey) : "";
  }

  function project(item) {
    if (Array.isArray(item)) return item.map(project);
    if (!item || typeof item !== "object") return item;
    const result = {};
    const localized = new Map();
    for (const [key, child] of Object.entries(item)) {
      if (key === "name" && child && typeof child === "object" && !Array.isArray(child) && typeof child.zh === "string") {
        localized.set("name", { zh: child.zh });
        continue;
      }
      const match = key.match(/^(.+)_(zh|en)$/);
      if (match) {
        const [,, sourceLocale] = match;
        const entry = localized.get(match[1]) || {};
        entry[sourceLocale] = child;
        localized.set(match[1], entry);
        continue;
      }
      result[key] = project(child);
    }
    for (const [field, variants] of localized) {
      const source = locale === "en"
        ? (variants.en ?? variants.zh ?? "")
        : (variants.zh ?? variants.en ?? "");
      const translated = translate(source, item, field, variants.en !== undefined);
      result[`${field}_zh`] = typeof translated === "string" ? translated : "";
    }
    return result;
  }

  return project(value);
}

function writeLocaleCatalogs(dir, catalogs, missing) {
  const localeDir = path.join(dir, "locales");
  fs.mkdirSync(localeDir, { recursive: true });
  return Object.fromEntries(["zh-Hans", "en"].map((locale) => {
    const value = catalogs[locale] || {};
    const file = path.join(localeDir, `${locale}.json`);
    const source = `\uFEFF${JSON.stringify(value, null, 2)}\n`;
    fs.writeFileSync(file, source, "utf8");
    const missingByCollection = {};
    for (const messageId of missing[locale] || []) {
      const collection = messageId.split(":")[0] || "other";
      missingByCollection[collection] = (missingByCollection[collection] || 0) + 1;
    }
    return [locale, {
      file: `locales/${locale}.json`,
      sha256: sha256Text(source),
      missing: { total: (missing[locale] || []).length, by_collection: missingByCollection },
    }];
  }));
}

function writeDatabaseReadme(file, index) {
  const notes = [
    `# ${index.dataset_name || "Victoria 3"} ${index.victoria3_version} 资料库数据层`,
    "",
    "这个目录用于后续网页读取。字段尽量保留原版脚本中的键名，同时补充网页可直接使用的对象编号、中文名和颜色值。",
    "",
    "## 文件",
    "",
    "- index.json：数据集入口，记录版本、文件名和数量。",
    "- countries.json：国家主数据。每个国家使用 country:TAG 作为对象编号。",
    "- cultures.json：文化主数据。每个文化使用 culture:key 作为对象编号。",
    "- culture_traits.json：文化特质，包括传承、语言和传统。",
    "- culture_trait_groups.json：文化特质组，用于东亚传承、罗曼语族等筛选。",
    "- state_regions.json：地域主数据，包含资源键、地区特质、开局归属、文化本土和所属战略区域。",
    "- strategic_regions.json：战略区域主数据，包含下属地域、相关本土文化和开局国家。",
    "- geographic_regions.json：地理区域主数据，包含脚本定义的地理区域、下属地域和相关战略区域。",
    "- companies.json：公司类型主数据，包含史实/通用公司、控股类别、建筑、总部倾向、名贵商品、地区引用、条件脚本和繁荣效果。",
    "- company_charter_types.json：公司特许类型，包含图标、类型和 AI 条件脚本。",
    "- interest_groups.json：利益集团主数据，包含基础名称、颜色、图标引用、基础特质、基础意识形态和风味规则数量。",
    "- interest_group_traits.json：利益集团特质，包含审批阈值、图标引用和修正效果。",
    "- ideologies.json：意识形态主数据，包含图标引用和法律态度。",
    "- dynamic_country_name_variants.json：动态国名规则。DEFAULT 规则适用于通用叛乱等情况，具体 tag 规则适用于对应国家。",
    "- dynamic_country_map_color_rules.json：动态地图色规则。颜色已尽量转成十六进制值，触发条件仍保留脚本原文。",
    "- formable_countries.json：可成立国家规则表。",
    "- releasable_countries.json：可释放国家规则表。",
    "",
    "## 数量",
    "",
    `国家：${index.counts.countries}`,
    `文化：${index.counts.cultures}`,
    `文化特质：${index.counts.culture_traits}`,
    `文化特质组：${index.counts.culture_trait_groups}`,
    `地域：${index.counts.state_regions}`,
    `战略区域：${index.counts.strategic_regions}`,
    `地理区域：${index.counts.geographic_regions}`,
    `公司：${index.counts.companies}`,
    `公司特许类型：${index.counts.company_charter_types}`,
    `利益集团：${index.counts.interest_groups}`,
    `利益集团特质：${index.counts.interest_group_traits}`,
    `意识形态：${index.counts.ideologies}`,
    `动态国名规则：${index.counts.dynamic_country_name_variants}`,
    `动态地图色规则：${index.counts.dynamic_country_map_color_rules}`,
    `可成立国家规则：${index.counts.formable_countries}`,
    `可释放国家规则：${index.counts.releasable_countries}`,
    "",
    "## 说明",
    "",
    "国旗暂未渲染。后续可以先把 flag_definitions 和 coat_of_arms 的引用关系抽出来，再决定本地版和公开版分别怎样显示。",
    "",
  ];
  const fileListStart = notes.findIndex((note) => note.startsWith("- index.json"));
  const countHeading = notes.findIndex((note, index) => index > fileListStart && note.startsWith("## "));
  notes.splice(countHeading - 1, 0,
    "- achievements.json：成就主数据，包含难度、中文说明、提示条件、图标引用和原始达成脚本。",
    "- buildings.json：建筑图片墙和详情资料，包含建筑组、图标、资源地图资格与生产方式组引用。",
    "- building_groups.json：建筑组、上级组和默认分区资料。",
    "- production_method_groups.json：生产方式组和可选生产方式键。",
    "- production_methods.json：生产方式图标、科技、可用条件和分作用域修正。",
    "- goods.json：基础商品、图标、价格、本地商品属性、生产建筑和名贵商品引用。",
    "- prestige_goods.json：名贵商品与对应基础商品。",
    "- excluded_graphical_buildings.json：没有界面图标的装饰定位建筑审计清单。",
  );
  const updatedCountHeading = notes.findIndex((note, index) => index > fileListStart && note.startsWith("## "));
  const explanationHeading = notes.findIndex((note, index) => index > updatedCountHeading && note.startsWith("## "));
  notes.splice(explanationHeading - 1, 0,
    `成就：${index.counts.achievements}`,
    `建筑：${index.counts.buildings}`,
    `建筑组：${index.counts.building_groups}`,
    `生产方式组：${index.counts.production_method_groups}`,
    `生产方式：${index.counts.production_methods}`,
    `商品：${index.counts.goods}`,
    `名贵商品：${index.counts.prestige_goods}`,
    `图形占位建筑：${index.counts.excluded_graphical_buildings}`,
  );
  fs.writeFileSync(file, `\uFEFF${notes.join("\r\n")}\r\n`, "utf8");
}

function groupBy(rows, field) {
  const result = new Map();
  for (const row of rows) {
    const key = row[field] || "";
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(row);
  }
  return result;
}

function groupMapColorRulesByTag(rows) {
  const result = new Map();
  for (const row of rows) {
    for (const tag of splitJoined(row.referenced_tags)) {
      if (!result.has(tag)) result.set(tag, []);
      result.get(tag).push(row);
    }
  }
  return result;
}

function joinValues(values) {
  return [...new Set(values.filter(Boolean))].join("; ");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function splitJoined(value) {
  if (!value) return [];
  return String(value)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function stripPrefix(value) {
  if (!value || typeof value !== "string") return value || "";
  return value.replace(/^(c|cu|rel|s|sr|g|law_type|rank_value|ig|ig_trait|ideology):/, "");
}

function scriptEntryKey(value) {
  return String(value || "").replace(/^(?:REPLACE_OR_CREATE|REPLACE|CREATE):/i, "");
}

function stripQuotes(value) {
  if (!value || typeof value !== "string") return value || "";
  return value.replace(/^"(.*)"$/, "$1");
}

function normalizeProvinceColor(value) {
  const raw = stripQuotes(String(value || "")).trim();
  const match = raw.match(/^x?([0-9a-fA-F]{6})$/);
  return match ? `x${match[1].toUpperCase()}` : "";
}

function toNumberOrNull(value) {
  if (value === "" || value === undefined || value === null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function boolFromYesNo(value) {
  return value === "yes";
}

function parseColorValue(value) {
  if (!value) return null;
  if (typeof value === "string") return null;
  if (value.fn) {
    const items = nodeItems(asNode(value.args)).map(Number).filter(Number.isFinite);
    return colorFromModel(value.fn, items);
  }
  const node = asNode(value);
  if (!node) return null;
  const items = nodeItems(node).map(Number).filter(Number.isFinite);
  return colorFromModel("rgb255", items);
}

function colorFromModel(model, values) {
  if (values.length < 3) return null;
  let rgb;
  if (model === "rgb") {
    rgb = values.slice(0, 3).map((value) => value <= 1 ? Math.round(value * 255) : Math.round(value));
  } else if (model === "hsv" || model === "hsv360") {
    const h = values[0];
    const s = values[1] > 1 ? values[1] / 100 : values[1];
    const v = values[2] > 1 ? values[2] / 100 : values[2];
    rgb = hsvToRgb(h, s, v);
  } else {
    const direct = values.slice(0, 3);
    rgb = direct.every((value) => value <= 1)
      ? direct.map((value) => Math.round(value * 255))
      : direct.map((value) => Math.round(value));
  }
  rgb = rgb.map((value) => clamp(value, 0, 255));
  return {
    model,
    raw: values.slice(0, 3).join(" "),
    rgb,
    hex: rgbToHex(rgb),
  };
}

function hsvToRgb(h, s, v) {
  const hue = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = v - c;
  let rgbPrime;
  if (hue < 60) rgbPrime = [c, x, 0];
  else if (hue < 120) rgbPrime = [x, c, 0];
  else if (hue < 180) rgbPrime = [0, c, x];
  else if (hue < 240) rgbPrime = [0, x, c];
  else if (hue < 300) rgbPrime = [x, 0, c];
  else rgbPrime = [c, 0, x];
  return rgbPrime.map((value) => Math.round((value + m) * 255));
}

function rgbToHex(rgb) {
  return `#${rgb.map((value) => clamp(value, 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizePath(file) {
  return file.replaceAll("\\", "/");
}

function writeJson(file, value) {
  fs.writeFileSync(file, `\uFEFF${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeCsv(file, rows, headers) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header] ?? "")).join(","));
  }
  fs.writeFileSync(file, `\uFEFF${lines.join("\r\n")}\r\n`, "utf8");
}

function csvCell(value) {
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function writeNotes(file, data) {
  const {
    version,
    datasetName,
    gamePath,
    modPath,
    countryRows,
    releaseRows,
    formationRows,
    dynamicTags,
    dynamicNameVariants,
    dynamicMapColorRules,
    cultures,
    cultureTraits,
    cultureTraitGroups,
    stateRegions,
    strategicRegions,
    companies,
    companyCharterTypes,
    interestGroups,
    interestGroupTraits,
    ideologies,
    definitions,
    startingOwners,
    historyCountryTags,
  } = data;
  const missingDefinition = countryRows.filter((row) => !row.definition_file).map((row) => row.tag);
  const missingReligion = countryRows.filter((row) => !row.religion).map((row) => row.tag);
  const tiers = countBy(countryRows, "tier");
  const types = countBy(countryRows, "country_type");
  const notes = [
    `# ${datasetName} ${version} 国家数据抽取说明`,
    "",
    `游戏目录：${gamePath.replaceAll("\\", "/")}`,
    modPath ? `模组目录：${modPath.replaceAll("\\", "/")}` : "",
    "",
    "## 输出文件",
    "",
    `- vic3_${version}_countries.csv：国家主表。`,
    `- vic3_${version}_formable_countries.csv：可成立国家规则表。`,
    `- vic3_${version}_releasable_countries.csv：可释放国家规则表。`,
    `- vic3_${version}_countries.json：与国家、文化、动态国名和动态地图色对应的结构化数据。`,
    `- ${path.relative(path.dirname(file), databaseDir).replaceAll("\\", "/")}：后续网页使用的数据层目录。`,
    "",
    "## 字段来源",
    "",
    "tag、主流文化、国家类型、国家位阶、首都、标准色和国家定义宗教来自 common/country_definitions。文化名称、颜色、默认宗教、传承、语言、传统、痴迷和禁忌来自 common/cultures。文化特质和特质组来自 common/discrimination_traits 与 common/discrimination_trait_groups。地域、资源键和地区特质来自 map_data/state_regions。战略区域来自 common/strategic_regions。公司来自 common/company_types，公司特许来自 common/company_charter_types。利益集团来自 common/interest_groups，利益集团特质来自 common/interest_group_traits，意识形态来自 common/ideologies。开局存在与开局归属以 common/history/states/00_states.txt 中的 create_state 为准，文化本土来自同一文件中的 add_homeland。可释放国家来自 common/country_creation。可成立国家来自 common/country_formation。动态国名来自 common/dynamic_country_names。动态地图色来自 common/dynamic_country_map_colors，颜色键取 common/named_colors。中文名称来自 localization/simp_chinese。宗教优先取 history/countries 中的 set_state_religion；没有历史覆盖时取国家定义中的 religion；国家定义未写 religion 时，取第一个主流文化在 common/cultures 中的 religion，并在 religion_source 字段标明来源。can_form_tags_by_primary_culture 和 can_form_names_zh_by_primary_culture 是按主流文化与成立国家规则推断的查询列；游戏内仍会检查科技、日志条目、政府、地区控制等条件。",
    "",
    "## 数量校验",
    "",
    `国家定义总数：${definitions.size}。`,
    `动态占位 tag 排除数：${dynamicTags.length}。`,
    `主表国家数：${countryRows.length}。`,
    `开局拥有领土的 tag 数：${startingOwners.size}。`,
    `存在 history/countries 设置的 tag 数：${historyCountryTags.size}。`,
    `可释放国家数：${releaseRows.length}。`,
    `可成立国家数：${formationRows.length}。`,
    `文化数：${cultures.length}。`,
    `文化特质数：${cultureTraits.length}。`,
    `文化特质组数：${cultureTraitGroups.length}。`,
    `地域数：${stateRegions.length}。`,
    `战略区域数：${strategicRegions.length}。`,
    `公司数：${companies.length}。`,
    `公司特许类型数：${companyCharterTypes.length}。`,
    `利益集团数：${interestGroups.length}。`,
    `利益集团特质数：${interestGroupTraits.size}。`,
    `意识形态数：${ideologies.size}。`,
    `动态国名规则数：${dynamicNameVariants.length}。`,
    `动态地图色规则数：${dynamicMapColorRules.length}。`,
    "",
    "国家类型分布：",
    ...Object.entries(types).sort().map(([key, value]) => `- ${key || "(空)"}：${value}`),
    "",
    "国家位阶分布：",
    ...Object.entries(tiers).sort().map(([key, value]) => `- ${key || "(空)"}：${value}`),
    "",
    "## 需注意的记录",
    "",
    `没有普通国家定义的 tag 数：${missingDefinition.length}${missingDefinition.length ? `，${missingDefinition.join(", ")}` : "。"}`,
    `没有宗教结果的 tag 数：${missingReligion.length}${missingReligion.length ? `，${missingReligion.join(", ")}` : "。"}`,
    "",
    "位阶威望来自 common/defines/00_defines.txt。grand_principality 的官方简中写法为“大公国”，tier_prestige 为 10；principality 为“公国”，tier_prestige 为 5。D00 到 D99 这类 dynamic_country_definition = yes 的占位 tag 已从主表排除。国旗尚未渲染，本阶段只把可直接使用的标准色、动态国名和动态地图色整理进数据层。",
    "",
  ];
  fs.writeFileSync(file, `\uFEFF${notes.join("\r\n")}\r\n`, "utf8");
}

function countBy(rows, field) {
  const counts = {};
  for (const row of rows) {
    const key = row[field] || "";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function parseScript(text, file = "<memory>") {
  const tokens = tokenize(text);
  let index = 0;

  function parseSequence(stopAtBrace) {
    const node = { assignments: [], items: [] };
    while (index < tokens.length) {
      const token = tokens[index];
      if (token === "}") {
        if (stopAtBrace) {
          index += 1;
          return node;
        }
        throw new Error(`多余的右花括号: ${file}`);
      }
      const next = tokens[index + 1];
      if (isOperator(next)) {
        const key = token;
        const op = next;
        index += 2;
        const value = tokens[index] === "}" ? "" : parseValue();
        node.assignments.push({ key, op, value });
      } else {
        node.items.push(parseValue());
      }
    }
    if (stopAtBrace) throw new Error(`缺少右花括号: ${file}`);
    return node;
  }

  function parseValue() {
    const token = tokens[index];
    if (token === undefined) throw new Error(`缺少值: ${file}`);
    if (token === "{") {
      index += 1;
      return parseSequence(true);
    }
    if (tokens[index + 1] === "{") {
      index += 1;
      const args = parseValue();
      return { fn: token, args };
    }
    index += 1;
    return token;
  }

  return parseSequence(false);
}

function tokenize(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "#") {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "\"") {
      let value = "";
      i += 1;
      while (i < text.length) {
        if (text[i] === "\\" && i + 1 < text.length) {
          value += text[i + 1];
          i += 2;
          continue;
        }
        if (text[i] === "\"") {
          i += 1;
          break;
        }
        value += text[i];
        i += 1;
      }
      tokens.push(value);
      continue;
    }
    if (ch === "{" || ch === "}") {
      tokens.push(ch);
      i += 1;
      continue;
    }
    const two = text.slice(i, i + 2);
    if (two === "?=" || two === ">=" || two === "<=" || two === "!=" || two === "==") {
      tokens.push(two);
      i += 2;
      continue;
    }
    if (ch === "=" || ch === ">" || ch === "<") {
      tokens.push(ch);
      i += 1;
      continue;
    }
    let value = "";
    while (i < text.length) {
      const c = text[i];
      if (/\s/.test(c) || c === "#" || c === "{" || c === "}" || c === "=" || c === ">" || c === "<") break;
      if (c === "?" && text[i + 1] === "=") break;
      value += c;
      i += 1;
    }
    if (value) tokens.push(value);
  }
  return tokens;
}

function isOperator(token) {
  return token === "=" || token === "?=" || token === ">=" || token === "<=" || token === ">" || token === "<" || token === "!=" || token === "==";
}

function asNode(value) {
  if (value && typeof value === "object" && Array.isArray(value.assignments)) return value;
  if (value && typeof value === "object" && value.args) return asNode(value.args);
  return null;
}

function firstValue(node, key) {
  return node.assignments.find((assignment) => assignment.key === key)?.value;
}

function firstValueAnyCase(node, key) {
  const lower = key.toLowerCase();
  return node.assignments.find((assignment) => assignment.key.toLowerCase() === lower)?.value;
}

function allValues(node, key) {
  return node.assignments
    .filter((assignment) => assignment.key === key)
    .map((assignment) => assignment.value);
}

function firstScalar(node, key) {
  const value = firstValueAnyCase(node, key);
  if (typeof value === "string") return value;
  return "";
}

function nodeItems(node) {
  const result = [];
  for (const item of node.items) {
    if (typeof item === "string") result.push(item);
  }
  return result;
}

function collectScalarRefs(value, prefix, out = new Set()) {
  if (typeof value === "string") {
    if (value.startsWith(prefix)) out.add(value);
    return out;
  }
  const node = asNode(value);
  if (!node) return out;
  for (const item of node.items) collectScalarRefs(item, prefix, out);
  for (const assignment of node.assignments) {
    if (assignment.key.startsWith(prefix)) out.add(assignment.key);
    collectScalarRefs(assignment.value, prefix, out);
  }
  return out;
}

function collectTagRefs(value, out = new Set()) {
  if (typeof value === "string") {
    const direct = value.match(/^c:([A-Z0-9]{3})$/);
    if (direct) out.add(direct[1]);
    return out;
  }
  const node = asNode(value);
  if (!node) return out;
  for (const item of node.items) collectTagRefs(item, out);
  for (const assignment of node.assignments) {
    const keyMatch = assignment.key.match(/^c:([A-Z0-9]{3})$/);
    if (keyMatch) out.add(keyMatch[1]);
    collectTagRefs(assignment.value, out);
  }
  return out;
}

function collectStateRegionRefs(value, out = new Set()) {
  if (typeof value === "string") {
    const normalized = stripPrefix(value);
    if (normalized.startsWith("STATE_")) out.add(normalized);
    return out;
  }
  const node = asNode(value);
  if (!node) return out;
  for (const item of node.items) collectStateRegionRefs(item, out);
  for (const assignment of node.assignments) {
    collectStateRegionRefs(assignment.key, out);
    collectStateRegionRefs(assignment.value, out);
  }
  return out;
}

function collectStrategicRegionRefs(value, out = new Set()) {
  if (typeof value === "string") {
    const normalized = stripPrefix(value);
    if (normalized.startsWith("region_")) out.add(normalized);
    return out;
  }
  const node = asNode(value);
  if (!node) return out;
  for (const item of node.items) collectStrategicRegionRefs(item, out);
  for (const assignment of node.assignments) {
    collectStrategicRegionRefs(assignment.key, out);
    collectStrategicRegionRefs(assignment.value, out);
  }
  return out;
}

function collectGeographicRegionRefs(value, out = new Set()) {
  if (typeof value === "string") {
    const normalized = stripPrefix(value);
    if (normalized.startsWith("geographic_region_")) out.add(normalized);
    return out;
  }
  const node = asNode(value);
  if (!node) return out;
  for (const item of node.items) collectGeographicRegionRefs(item, out);
  for (const assignment of node.assignments) {
    collectGeographicRegionRefs(assignment.key, out);
    collectGeographicRegionRefs(assignment.value, out);
  }
  return out;
}

function collectCultureRefs(value, out = new Set()) {
  if (typeof value === "string") {
    if (value.startsWith("cu:")) out.add(stripPrefix(value));
    return out;
  }
  const node = asNode(value);
  if (!node) return out;
  for (const item of node.items) collectCultureRefs(item, out);
  for (const assignment of node.assignments) {
    if (assignment.key.startsWith("cu:")) out.add(stripPrefix(assignment.key));
    collectCultureRefs(assignment.value, out);
  }
  return out;
}

function collectReligionRefs(value, out = new Set()) {
  if (typeof value === "string") {
    if (value.startsWith("rel:")) out.add(stripPrefix(value));
    return out;
  }
  const node = asNode(value);
  if (!node) return out;
  for (const item of node.items) collectReligionRefs(item, out);
  for (const assignment of node.assignments) {
    if (assignment.key.startsWith("rel:")) out.add(stripPrefix(assignment.key));
    collectReligionRefs(assignment.value, out);
  }
  return out;
}

function collectInterestGroupRefs(value, out = new Set()) {
  if (typeof value === "string") {
    const normalized = stripPrefix(value);
    if (normalized.startsWith("ig_")) out.add(normalized);
    return out;
  }
  const node = asNode(value);
  if (!node) return out;
  for (const item of node.items) collectInterestGroupRefs(item, out);
  for (const assignment of node.assignments) {
    if (assignment.key === "is_interest_group_type") {
      const key = stripPrefix(scalarFromValue(assignment.value));
      if (key) out.add(key);
    }
    const scoped = assignment.key.match(/(?:^|\.)ig:(ig_[A-Za-z0-9_]+)$/);
    if (scoped) out.add(scoped[1]);
    collectInterestGroupRefs(assignment.value, out);
  }
  return out;
}

function collectLawRefs(value, out = new Set()) {
  if (typeof value === "string") {
    const normalized = stripPrefix(value);
    if (normalized.startsWith("law_")) out.add(normalized);
    return out;
  }
  const node = asNode(value);
  if (!node) return out;
  for (const item of node.items) collectLawRefs(item, out);
  for (const assignment of node.assignments) {
    if (assignment.key === "has_law_or_variant" || assignment.key === "activate_law") {
      const key = stripPrefix(scalarFromValue(assignment.value));
      if (key) out.add(key);
    }
    if (assignment.key.startsWith("law_type:")) out.add(stripPrefix(assignment.key));
    collectLawRefs(assignment.value, out);
  }
  return out;
}

function collectCharacterTraitRefs(value, out = new Set()) {
  if (typeof value === "string") return out;
  const node = asNode(value);
  if (!node) return out;
  for (const item of node.items) collectCharacterTraitRefs(item, out);
  for (const assignment of node.assignments) {
    if (assignment.key === "has_trait" || assignment.key === "add_trait") {
      const key = stripPrefix(scalarFromValue(assignment.value));
      if (key) out.add(key.startsWith("trait_") ? key : `trait_${key}`);
    }
    collectCharacterTraitRefs(assignment.value, out);
  }
  return out;
}

function collectBuildingRefs(value, out = new Set()) {
  if (typeof value === "string") {
    const normalized = stripPrefix(value);
    if (normalized.startsWith("building_")) out.add(normalized);
    return out;
  }
  const node = asNode(value);
  if (!node) return out;
  for (const item of node.items) collectBuildingRefs(item, out);
  for (const assignment of node.assignments) {
    collectBuildingRefs(assignment.key, out);
    collectBuildingRefs(assignment.value, out);
  }
  return out;
}

function collectTechnologyRefs(value, out = new Set()) {
  if (typeof value === "string") {
    for (const match of value.matchAll(/\bhas_technology_researched\s*=\s*([A-Za-z0-9_-]+)/g)) {
      out.add(stripPrefix(match[1]));
    }
    return out;
  }
  const node = asNode(value);
  if (!node) return out;
  for (const assignment of node.assignments) {
    if (assignment.key === "has_technology_researched") {
      const technology = stripPrefix(scalarFromValue(assignment.value));
      if (technology) out.add(technology);
    }
    collectTechnologyRefs(assignment.value, out);
  }
  for (const item of node.items) collectTechnologyRefs(item, out);
  return out;
}

function collectJournalEntryRefs(value, out = new Set()) {
  if (typeof value === "string") {
    return collectJournalEntryRefsFromText(value, out);
  }
  const node = asNode(value);
  if (!node) return out;
  for (const item of node.items) collectJournalEntryRefs(item, out);
  for (const assignment of node.assignments) {
    if (assignment.key === "has_journal_entry" || assignment.key === "is_involved_in_journal_entry") {
      const journal = stripPrefix(scalarFromValue(assignment.value));
      if (journal) out.add(journal);
    }
    if (assignment.key.startsWith("je:")) out.add(stripPrefix(assignment.key));
    if (assignment.key === "add_journal_entry") {
      const nodeValue = asNode(assignment.value);
      const journal = nodeValue ? stripPrefix(firstScalar(nodeValue, "type")) : stripPrefix(scalarFromValue(assignment.value));
      if (journal) out.add(journal);
    }
    collectJournalEntryRefs(assignment.value, out);
  }
  return out;
}

function collectJournalEntryRefsFromText(value, out = new Set()) {
  const text = String(value || "");
  for (const match of text.matchAll(/\b(?:has_journal_entry|is_involved_in_journal_entry)\s*=\s*([A-Za-z0-9_-]+)/g)) {
    out.add(stripPrefix(match[1]));
  }
  for (const match of text.matchAll(/\bje:([A-Za-z0-9_-]+)/g)) {
    out.add(stripPrefix(match[1]));
  }
  for (const match of text.matchAll(/\btype\s*=\s*(je_[A-Za-z0-9_-]+)/g)) {
    out.add(stripPrefix(match[1]));
  }
  return out;
}

function summarizeUnlockCondition(value, loc) {
  const technologyKeys = [...collectTechnologyRefs(value)].sort();
  const journalKeys = [...collectJournalEntryRefs(value)].sort();
  const variableKeys = [...collectVariableRefs(value)].sort();
  const parts = [];
  if (technologyKeys.length) parts.push(`科技：${technologyKeys.map((key) => locName(loc, key)).join("、")}`);
  if (journalKeys.length) parts.push(`日志条目：${journalKeys.map((key) => locName(loc, key)).join("、")}`);
  if (variableKeys.length) parts.push(`变量：${variableKeys.join("、")}`);
  return parts.length ? parts.join("；") : "脚本条件";
}

function refsToObjects(keys, loc) {
  return unique(keys || []).filter(Boolean).sort().map((key) => ({
    key,
    name_zh: locName(loc, key),
  }));
}

function journalRefsToObjects(keys, loc) {
  return refsToObjects([...(keys || [])], loc);
}

function normalizeIdeologyUnlockKey(key) {
  if (!key) return "";
  const normalized = stripPrefix(key);
  if (!normalized.startsWith("ideology_")) return "";
  if (normalized === "ideology_corporatist_leader") return "ideology_corporatist";
  if (normalized.endsWith("_movement")) return normalized.replace(/_movement$/, "");
  return normalized;
}

function collectAssignedScalarValues(value, assignmentKey, out = new Set()) {
  const node = asNode(value);
  if (!node) return out;
  for (const assignment of node.assignments) {
    if (assignment.key === assignmentKey) {
      const scalar = stripPrefix(scalarFromValue(assignment.value));
      if (scalar) out.add(scalar);
    }
    collectAssignedScalarValues(assignment.value, assignmentKey, out);
  }
  for (const item of node.items) collectAssignedScalarValues(item, assignmentKey, out);
  return out;
}

function collectVariableRefs(value, out = new Set()) {
  if (typeof value === "string") {
    const variable = value.match(/^var:([A-Za-z0-9_]+)$/);
    if (variable) out.add(variable[1]);
    return out;
  }
  const node = asNode(value);
  if (!node) return out;
  for (const item of node.items) collectVariableRefs(item, out);
  for (const assignment of node.assignments) {
    if (assignment.key === "has_variable" || assignment.key === "remove_variable" || assignment.key === "set_variable") {
      const scalar = scalarFromValue(assignment.value);
      if (scalar) out.add(stripPrefix(scalar));
    }
    const keyVariable = assignment.key.match(/^var:([A-Za-z0-9_]+)$/);
    if (keyVariable) out.add(keyVariable[1]);
    collectVariableRefs(assignment.value, out);
  }
  return out;
}

function stringifyScriptValue(value, indent = 0) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (value.fn) {
    const args = stringifyScriptValue(value.args, indent);
    return `${value.fn} ${args}`;
  }
  const node = asNode(value);
  if (!node) return "";
  const pad = "  ".repeat(indent);
  const innerPad = "  ".repeat(indent + 1);
  const lines = ["{"];
  for (const item of node.items) {
    lines.push(`${innerPad}${stringifyScriptValue(item, indent + 1)}`);
  }
  for (const assignment of node.assignments) {
    const rendered = stringifyScriptValue(assignment.value, indent + 1);
    if (rendered.includes("\n")) {
      lines.push(`${innerPad}${assignment.key} ${assignment.op} ${rendered}`);
    } else {
      lines.push(`${innerPad}${assignment.key} ${assignment.op} ${rendered}`);
    }
  }
  lines.push(`${pad}}`);
  return lines.join("\n");
}

function scalarFromValue(value) {
  if (typeof value === "string") return value;
  return "";
}

function isPlainTagLike(key) {
  return /^[A-Za-z0-9_]+$/.test(key);
}

main();
