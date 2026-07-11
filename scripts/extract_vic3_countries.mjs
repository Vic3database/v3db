import fs from "node:fs";
import path from "node:path";

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
  const cultures = loadCultures(contentPath("common", "cultures"));
  const cultureTraits = loadCultureTraits(contentPath("common", "discrimination_traits"), loc);
  const cultureTraitGroups = loadCultureTraitGroups(contentPath("common", "discrimination_trait_groups"), loc);
  const religions = loadReligions(contentPath("common", "religions"));
  const definitions = loadCountryDefinitions(contentPath("common", "country_definitions"));
  const stateHistory = loadStateHistory(contentPath("common", "history", "states", "00_states.txt"));
  const startingOwners = stateHistory.startingOwnersByCountry;
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
  const interestGroups = loadInterestGroups(
    contentPath("common", "interest_groups"),
    loc,
    interestGroupTraits,
    ideologies,
  );
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
      historyCountryTags,
      historyReligionOverrides,
      releasables,
      formables,
      canFormByCulture,
      dynamicNameVariantsByScope,
      dynamicMapColorRulesByTag,
    }));
  const cultureRows = buildCultureRows(cultures, cultureTraits, cultureTraitGroups, relatedCountriesByCulture, stateRegionRows, loc);
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
    ideologies: [...ideologies.values()],
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
    interestGroupTraits,
    ideologies,
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

function readText(file) {
  return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
}

function loadLocalization(dir) {
  const loc = new Map();
  const files = listFiles(dir, ".yml");
  const linePattern = /^\s*([^#\s:]+):(?:\d+)?\s*"((?:\\.|[^"\\])*)"\s*(?:#.*)?$/;
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
      cultures.set(key, {
        key,
        color,
        religion: stripPrefix(firstScalar(node, "religion")),
        heritage,
        language,
        traditions: traditionsNode ? nodeItems(traditionsNode).map(stripPrefix).sort() : [],
        obsessions: obsessionsNode ? nodeItems(obsessionsNode).map(stripPrefix).sort() : [],
        taboos: taboosNode ? nodeItems(taboosNode).map(stripPrefix).sort() : [],
        trait_keys: [heritage, language, ...(traditionsNode ? nodeItems(traditionsNode).map(stripPrefix) : [])].filter(Boolean).sort(),
        file: normalizePath(file),
      });
    }
  }
  return cultures;
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

function loadReligions(dir) {
  const religions = new Set();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!isPlainTagLike(key)) continue;
      religions.add(key);
    }
  }
  return religions;
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
      if (!key.startsWith("state_trait_")) continue;
      const node = asNode(assignment.value);
      if (!node) continue;
      const icon = stripQuotes(firstScalar(node, "icon"));
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
  if (journalEntries.length) parts.push(`日志：${journalEntries.map((key) => locName(loc, key)).join("、")}`);
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
      ...(row.journal_entries || []).map((key) => `日志：${locName(loc, key)}`),
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
    historyCountryTags,
    historyReligionOverrides,
    releasables,
    formables,
    canFormByCulture,
    dynamicNameVariantsByScope,
    dynamicMapColorRulesByTag,
  } = context;
  const startingStates = [...(startingOwners.get(tag) || [])].sort();
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

function buildCultureRows(cultures, cultureTraits, cultureTraitGroups, relatedCountriesByCulture, stateRegionRows, loc) {
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
        obsessions: (culture.obsessions || []).map((goodsKey) => goodsRef(goodsKey, loc)),
        taboos: (culture.taboos || []).map((goodsKey) => goodsRef(goodsKey, loc)),
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
  if (!Number.isFinite(numericValue)) return rawValue || "";
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
  result = result.replace(/@[A-Za-z0-9_]+!/g, "");
  result = result.replace(/#(?:[A-Za-z0-9_]+)?\s?/g, "").replace(/#!/g, "");
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
    interestGroupTraits,
    ideologies,
    geographicRegions,
    cultureRows,
    cultureTraitRows,
    cultureTraitGroupRows,
    dynamicNameVariants,
    dynamicMapColorRules,
    formableRules,
    formables,
    releasables,
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
      dynamic_country_name_variants: "dynamic_country_name_variants.json",
      dynamic_country_map_color_rules: "dynamic_country_map_color_rules.json",
      formable_countries: "formable_countries.json",
      releasable_countries: "releasable_countries.json",
    },
    counts: {
      countries: countries.length,
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
      dynamic_country_name_variants: dynamicNameVariants.length,
      dynamic_country_map_color_rules: dynamicMapColorRules.length,
      formable_countries: formables.length,
      releasable_countries: releasables.length,
    },
  };

  writeJson(path.join(dir, "index.json"), index);
  writeJson(path.join(dir, "countries.json"), countries);
  writeJson(path.join(dir, "cultures.json"), cultureRows);
  writeJson(path.join(dir, "culture_traits.json"), cultureTraitRows);
  writeJson(path.join(dir, "culture_trait_groups.json"), cultureTraitGroupRows);
  writeJson(path.join(dir, "state_regions.json"), stateRegionRows);
  writeJson(path.join(dir, "strategic_regions.json"), strategicRegionRows);
  writeJson(path.join(dir, "geographic_regions.json"), geographicRegionRows);
  writeJson(path.join(dir, "companies.json"), companies);
  writeJson(path.join(dir, "company_charter_types.json"), companyCharterTypes);
  writeJson(path.join(dir, "interest_groups.json"), interestGroups.map(publicInterestGroup));
  writeJson(path.join(dir, "interest_group_traits.json"), [...interestGroupTraits.values()]);
  writeJson(path.join(dir, "ideologies.json"), [...ideologies.values()]);
  writeJson(path.join(dir, "dynamic_country_name_variants.json"), dynamicNameVariants);
  writeJson(path.join(dir, "dynamic_country_map_color_rules.json"), dynamicMapColorRules);
  writeJson(path.join(dir, "formable_countries.json"), formables);
  writeJson(path.join(dir, "releasable_countries.json"), releasables);
  writeDatabaseReadme(path.join(dir, "README.md"), index);
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
    "- state_regions.json：州地区主数据，包含资源键、地区特质、开局归属、文化本土和所属战略区域。",
    "- strategic_regions.json：战略区域主数据，包含下属州地区、相关本土文化和开局国家。",
    "- geographic_regions.json：地理区域主数据，包含脚本定义的地理区域、下属州地区和相关战略区域。",
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
    `州地区：${index.counts.state_regions}`,
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
    "tag、主流文化、国家类型、国家位阶、首都、标准色和国家定义宗教来自 common/country_definitions。文化名称、颜色、默认宗教、传承、语言、传统、痴迷和禁忌来自 common/cultures。文化特质和特质组来自 common/discrimination_traits 与 common/discrimination_trait_groups。州地区、资源键和地区特质来自 map_data/state_regions。战略区域来自 common/strategic_regions。公司来自 common/company_types，公司特许来自 common/company_charter_types。利益集团来自 common/interest_groups，利益集团特质来自 common/interest_group_traits，意识形态来自 common/ideologies。开局存在与开局归属以 common/history/states/00_states.txt 中的 create_state 为准，文化本土来自同一文件中的 add_homeland。可释放国家来自 common/country_creation。可成立国家来自 common/country_formation。动态国名来自 common/dynamic_country_names。动态地图色来自 common/dynamic_country_map_colors，颜色键取 common/named_colors。中文名称来自 localization/simp_chinese。宗教优先取 history/countries 中的 set_state_religion；没有历史覆盖时取国家定义中的 religion；国家定义未写 religion 时，取第一个主流文化在 common/cultures 中的 religion，并在 religion_source 字段标明来源。can_form_tags_by_primary_culture 和 can_form_names_zh_by_primary_culture 是按主流文化与成立国家规则推断的查询列；游戏内仍会检查科技、日志条目、政府、地区控制等条件。",
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
    `州地区数：${stateRegions.length}。`,
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
  if (journalKeys.length) parts.push(`日志：${journalKeys.map((key) => locName(loc, key)).join("、")}`);
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
