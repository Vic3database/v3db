import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const databaseDir = path.resolve(args.database || "database/vic3_1.13.9");
const source = path.resolve(args.source || path.join(databaseDir, "index.json"));
const outDir = path.resolve(args.out || "site");

if (!fs.existsSync(source)) {
  throw new Error(`找不到数据文件：${source}`);
}

fs.mkdirSync(outDir, { recursive: true });

const data = deriveSiteData(loadSiteData(source));

const wikiData = {
  meta: data.meta,
  countries: data.countries,
  cultures: data.cultures,
  cultureTraits: data.cultureTraits,
  cultureTraitGroups: data.cultureTraitGroups,
  stateRegions: data.stateRegions,
  strategicRegions: data.strategicRegions,
  geographicRegions: data.geographicRegions,
  companies: data.companies,
  companyCharterTypes: data.companyCharterTypes,
  interestGroups: data.interestGroups,
  interestGroupTraits: data.interestGroupTraits,
  ideologies: data.ideologies,
  laws: data.laws,
  lawGroups: data.lawGroups,
  technologies: data.technologies,
  technologyEras: data.technologyEras,
  dynamicCountryNameVariants: data.dynamicCountryNameVariants,
  dynamicCountryMapColorRules: data.dynamicCountryMapColorRules,
  formables: data.formables,
  releasables: data.releasables,
};

const dataChunks = {
  country: ["countries", "dynamicCountryNameVariants", "dynamicCountryMapColorRules", "formables", "releasables"],
  culture: ["cultures", "cultureTraits", "cultureTraitGroups"],
  region: ["stateRegions", "strategicRegions", "geographicRegions"],
  company: ["companies", "companyCharterTypes"],
  ideology: ["interestGroups", "interestGroupTraits", "ideologies"],
  law: ["laws", "lawGroups"],
  technology: ["technologies", "technologyEras"],
};

const dataChunkFileNames = {
  country: "data-countries.js",
  culture: "data-cultures.js",
  region: "data-regions.js",
  company: "data-companies.js",
  ideology: "data-ideologies.js",
  law: "data-laws.js",
  technology: "data-technologies.js",
};

for (const [key, keys] of Object.entries(dataChunks)) {
  if (key === "country") continue;
  const chunk = Object.fromEntries(keys.map((field) => [field, wikiData[field] || []]));
  fs.writeFileSync(
    path.join(outDir, dataChunkFileNames[key]),
    `window.VIC3_DATA_CHUNK = ${JSON.stringify(chunk)};\n`,
    "utf8",
  );
}

const countryShardCount = 4;
const countryShardSize = Math.ceil(wikiData.countries.length / countryShardCount);
const countryShardFiles = [];
for (let index = 0; index < countryShardCount; index += 1) {
  const file = `data-countries-${index + 1}.js`;
  countryShardFiles.push(file);
  fs.writeFileSync(
    path.join(outDir, file),
    `window.VIC3_DATA_CHUNK = ${JSON.stringify({ countries: wikiData.countries.slice(index * countryShardSize, (index + 1) * countryShardSize) })};\n`,
    "utf8",
  );
}
const countryMetaFile = "data-country-meta.js";
countryShardFiles.push(countryMetaFile);
fs.writeFileSync(
  path.join(outDir, countryMetaFile),
  `window.VIC3_DATA_CHUNK = ${JSON.stringify(Object.fromEntries(dataChunks.country.slice(1).map((field) => [field, wikiData[field] || []])))};\n`,
  "utf8",
);

const dataIndex = {
  meta: wikiData.meta,
  chunks: Object.fromEntries(Object.entries(dataChunks).map(([key, keys]) => [key, {
    files: key === "country" ? countryShardFiles : [dataChunkFileNames[key]],
    keys,
    counts: Object.fromEntries(keys.map((field) => [field, Array.isArray(wikiData[field]) ? wikiData[field].length : 0])),
  }])),
};

fs.writeFileSync(
  path.join(outDir, "data-index.js"),
  `window.VIC3_DATA_INDEX = ${JSON.stringify(dataIndex)};\n`,
  "utf8",
);
fs.rmSync(path.join(outDir, "data.js"), { force: true });
for (const legacyFile of ["data-countries.js", "data-countrys.js", "data-companys.js", "data-ideologys.js"]) {
  fs.rmSync(path.join(outDir, legacyFile), { force: true });
}

console.log(JSON.stringify({
  source,
  outDir,
  countries: wikiData.countries.length,
  cultures: wikiData.cultures.length,
  cultureTraits: wikiData.cultureTraits.length,
  cultureTraitGroups: wikiData.cultureTraitGroups.length,
  stateRegions: wikiData.stateRegions.length,
  strategicRegions: wikiData.strategicRegions.length,
  geographicRegions: wikiData.geographicRegions.length,
  companies: wikiData.companies.length,
  companyCharterTypes: wikiData.companyCharterTypes.length,
  interestGroups: wikiData.interestGroups.length,
  interestGroupTraits: wikiData.interestGroupTraits.length,
  ideologies: wikiData.ideologies.length,
  laws: wikiData.laws.length,
  lawGroups: wikiData.lawGroups.length,
  dynamicCountryNameVariants: wikiData.dynamicCountryNameVariants.length,
  dynamicCountryMapColorRules: wikiData.dynamicCountryMapColorRules.length,
  formables: wikiData.formables.length,
  releasables: wikiData.releasables.length,
}, null, 2));

function loadSiteData(sourceFile) {
  const sourceData = readJson(sourceFile);
  if (sourceData.schema_version && sourceData.files) {
    const baseDir = path.dirname(sourceFile);
    const countries = readJson(path.join(baseDir, sourceData.files.countries));
    const cultures = readJson(path.join(baseDir, sourceData.files.cultures));
    const cultureTraits = readJson(path.join(baseDir, sourceData.files.culture_traits));
    const cultureTraitGroups = readJson(path.join(baseDir, sourceData.files.culture_trait_groups));
    const stateRegions = sourceData.files.state_regions ? readJson(path.join(baseDir, sourceData.files.state_regions)) : [];
    const strategicRegions = sourceData.files.strategic_regions ? readJson(path.join(baseDir, sourceData.files.strategic_regions)) : [];
    const geographicRegions = sourceData.files.geographic_regions ? readJson(path.join(baseDir, sourceData.files.geographic_regions)) : [];
    const companies = sourceData.files.companies ? readJson(path.join(baseDir, sourceData.files.companies)) : [];
    const companyCharterTypes = sourceData.files.company_charter_types ? readJson(path.join(baseDir, sourceData.files.company_charter_types)) : [];
    const interestGroups = sourceData.files.interest_groups ? readJson(path.join(baseDir, sourceData.files.interest_groups)) : [];
    const interestGroupTraits = sourceData.files.interest_group_traits ? readJson(path.join(baseDir, sourceData.files.interest_group_traits)) : [];
    const ideologies = sourceData.files.ideologies ? readJson(path.join(baseDir, sourceData.files.ideologies)) : [];
    const laws = sourceData.files.laws ? readJson(path.join(baseDir, sourceData.files.laws)) : [];
    const technologies = sourceData.files.technologies ? readJson(path.join(baseDir, sourceData.files.technologies)) : [];
    const technologyEras = sourceData.files.technology_eras ? readJson(path.join(baseDir, sourceData.files.technology_eras)) : [];
    const lawGroups = sourceData.files.law_groups ? readJson(path.join(baseDir, sourceData.files.law_groups)) : [];
    const dynamicCountryNameVariants = readJson(path.join(baseDir, sourceData.files.dynamic_country_name_variants));
    const dynamicCountryMapColorRules = readJson(path.join(baseDir, sourceData.files.dynamic_country_map_color_rules));
    const formables = readJson(path.join(baseDir, sourceData.files.formable_countries));
    const releasables = readJson(path.join(baseDir, sourceData.files.releasable_countries));
    const nameById = new Map(dynamicCountryNameVariants.map((variant) => [variant.id, variant]));
    const colorById = new Map(dynamicCountryMapColorRules.map((rule) => [rule.id, rule]));
    return {
      meta: {
        dataset_name: sourceData.dataset_name,
        site_title: sourceData.site_title || (sourceData.dataset_name ? `${sourceData.dataset_name} Database` : ""),
        victoria3_version: sourceData.victoria3_version,
        game_path: sourceData.game_path,
        mod_path: sourceData.mod_path,
        source_paths: sourceData.source_paths,
        generated_at: sourceData.generated_at,
        default_dynamic_country_name_variant_count: dynamicCountryNameVariants.filter((variant) => variant.scope === "DEFAULT").length,
      },
      countries: countries.map((country) => flattenDatabaseCountry(country, nameById, colorById)),
      cultures,
      cultureTraits,
      cultureTraitGroups,
      stateRegions,
      strategicRegions,
      geographicRegions,
      companies,
      companyCharterTypes,
      interestGroups,
      interestGroupTraits,
      ideologies,
      laws,
      lawGroups,
      technologies,
      technologyEras,
      dynamicCountryNameVariants,
      dynamicCountryMapColorRules,
      formables,
      releasables,
    };
  }
  return loadLegacyData(sourceData);
}

function deriveSiteData(siteData) {
  const visibleGeographicRegions = (siteData.geographicRegions || []).filter((region) => !region.is_current_strategic_region);
  return {
    ...siteData,
    countries: siteData.countries.map(deriveCountryRecord),
    cultures: deriveCultureRecords(siteData.cultures || []),
    companies: siteData.companies || [],
    geographicRegions: visibleGeographicRegions,
    companyCharterTypes: siteData.companyCharterTypes || [],
    interestGroups: siteData.interestGroups || [],
    interestGroupTraits: siteData.interestGroupTraits || [],
    ideologies: siteData.ideologies || [],
    laws: siteData.laws || [],
    lawGroups: siteData.lawGroups || [],
    technologies: siteData.technologies || [],
    technologyEras: siteData.technologyEras || [],
  };
}

function deriveCountryRecord(country) {
  const countryName = disambiguateCountryName(country.tag, country.name || country.name_zh || country.tag);
  const primaryCultureTraits = uniqueByKey(country.primaryCultureTraits || []);
  const primaryCultureTraitGroups = uniqueByKey(country.primaryCultureTraitGroups || []);
  const primaryCultureHomelandStateRegions = uniqueByKey(country.primaryCultureHomelandStateRegions || []);
  const primaryCultureHomelandStrategicRegions = uniqueByKey(country.primaryCultureHomelandStrategicRegions || []);
  const formationStateRegions = uniqueByKey(country.formationStateRegions || []);
  const formationStrategicRegions = uniqueByKey(country.formationStrategicRegions || []);
  const locationStateRegions = uniqueByKey(country.locationStateRegions || []);
  const locationStrategicRegions = uniqueByKey(country.locationStrategicRegions || []);
  const primaryCultureHeritages = primaryCultureTraits.filter((trait) => trait.type === "heritage");
  const primaryCultureLanguages = primaryCultureTraits.filter((trait) => trait.type === "language");
  const primaryCultureTraditions = primaryCultureTraits.filter((trait) => trait.type === "tradition");
  const primaryCultureHeritageGroups = primaryCultureTraitGroups.filter((group) => group.type === "heritage");
  const primaryCultureLanguageGroups = primaryCultureTraitGroups.filter((group) => group.type === "language");
  return {
    ...country,
    name: countryName,
    primaryCultureTraits,
    primaryCultureTraitGroups,
    primaryCultureHomelandStateRegions,
    primaryCultureHomelandStrategicRegions,
    formationStateRegions,
    formationStrategicRegions,
    locationStateRegions,
    locationStrategicRegions,
    primaryCultureHeritages,
    primaryCultureLanguages,
    primaryCultureTraditions,
    primaryCultureHeritageGroups,
    primaryCultureLanguageGroups,
    isDualHeritage: boolText(primaryCultureHeritageGroups.length > 1),
  };
}

function disambiguateCountryName(tag, name) {
  const text = String(name || "");
  if (tag === "BIC" && /^(东印度|East India)$/.test(text)) return "东印度（英属）";
  if (tag === "DEI" && /^(东印度|East India)$/.test(text)) return "东印度（荷属）";
  return text;
}

function deriveCultureRecords(cultures) {
  const byKey = new Map(cultures.map((culture) => [culture.key, culture]));
  const cultureKeysByHeritageGroup = new Map();
  const cultureKeysByLanguageGroup = new Map();
  const cultureKeysByTradition = new Map();

  for (const culture of cultures) {
    pushMapSet(cultureKeysByHeritageGroup, culture.heritage?.group_key, culture.key);
    pushMapSet(cultureKeysByLanguageGroup, culture.language?.group_key, culture.key);
    for (const tradition of culture.traditions || []) {
      pushMapSet(cultureKeysByTradition, tradition.key, culture.key);
    }
  }

  return cultures.map((culture) => ({
    ...culture,
    heritage_group: traitToGroupRef(culture.heritage),
    language_group: traitToGroupRef(culture.language),
    same_heritage_group_cultures: relatedCulturesByKeys(
      cultureKeysByHeritageGroup.get(culture.heritage?.group_key),
      culture.key,
      byKey,
    ),
    same_language_group_cultures: relatedCulturesByKeys(
      cultureKeysByLanguageGroup.get(culture.language?.group_key),
      culture.key,
      byKey,
    ),
    same_tradition_cultures: Object.fromEntries((culture.traditions || []).map((tradition) => [
      tradition.key,
      relatedCulturesByKeys(cultureKeysByTradition.get(tradition.key), culture.key, byKey),
    ])),
  }));
}

function flattenDatabaseCountry(country, nameById, colorById) {
  const dynamicNameVariants = (country.dynamic_country_name_variant_ids || [])
    .map((id) => nameById.get(id))
    .filter(Boolean);
  const dynamicMapColorRules = (country.dynamic_map_color_rule_ids || [])
    .map((id) => colorById.get(id))
    .filter(Boolean);
  return {
    tag: country.tag,
    name: country.name?.zh || country.tag,
    existsAtStart: boolText(country.status?.exists_at_start),
    startingStateCount: (country.starting_states || []).length,
    startingStates: (country.starting_states || []).map((state) => state.key),
    startingOverlordTag: country.starting_subject?.overlord_tag || "",
    startingOverlordName: country.starting_subject?.overlord_name_zh || "",
    startingSubjectType: country.starting_subject?.type || "",
    startingSubjectUsesOverlordColor: Boolean(country.starting_subject?.uses_overlord_color),
    hasHistoryCountryFile: boolText(country.status?.has_history_country_file),
    isReleasable: boolText(country.status?.is_releasable),
    isFormable: boolText(country.status?.is_formable),
    isMajorFormable: boolText(country.status?.is_major_formable),
    isMinorFormable: boolText(country.status?.is_formable && !country.status?.is_major_formable),
    isSpecial: boolText(country.special_mechanic?.is_special),
    specialMechanic: country.special_mechanic?.name_zh || "",
    specialTags: country.special_mechanic?.tags || [],
    canFormTags: (country.can_form_by_primary_culture || []).map((target) => target.tag),
    canFormNames: (country.can_form_by_primary_culture || []).map((target) => target.name_zh),
    primaryCultures: (country.primary_cultures || []).map((culture) => culture.key),
    primaryCulturesZh: (country.primary_cultures || []).map((culture) => culture.name_zh),
    religion: country.religion?.key || "",
    religionZh: country.religion?.name_zh || "",
    religionSource: country.religion?.source || "",
    tier: country.classification?.tier || "",
    tierZh: country.classification?.tier_zh || "",
    tierPrestige: String(country.classification?.tier_prestige ?? ""),
    countryType: country.classification?.country_type || "",
    countryTypeZh: country.classification?.country_type_zh || "",
    colorRgb: country.color?.rgb || [],
    colorHex: country.color?.hex || "",
    primaryUnitColor: country.unit_colors?.primary || "",
    secondaryUnitColor: country.unit_colors?.secondary || "",
    tertiaryUnitColor: country.unit_colors?.tertiary || "",
    capital: country.capital?.key || "",
    capitalZh: country.capital?.name_zh || "",
    dynamicNameVariants,
    usesDefaultDynamicCountryNameVariants: Boolean(country.uses_default_dynamic_country_name_variants),
    dynamicMapColorRules,
    formationRequiredCultures: (country.formation?.required_cultures || []).map((culture) => culture.key),
    formationRequiredCulturesZh: (country.formation?.required_cultures || []).map((culture) => culture.name_zh),
    formationStates: (country.formation?.states || []).map((state) => state.key),
    formationStateRegions: country.formation_state_regions || [],
    formationStrategicRegions: country.formation_strategic_regions || [],
    locationStateRegions: country.location_state_regions || [],
    locationStrategicRegions: country.location_strategic_regions || [],
    formationRegion: country.formation?.region || "",
    releaseStates: (country.release?.states || []).map((state) => state.key),
    primaryCultureTraits: country.primary_culture_traits || [],
    primaryCultureTraitGroups: country.primary_culture_trait_groups || [],
    primaryCultureHomelandStateRegions: country.primary_culture_homeland_state_regions || [],
    primaryCultureHomelandStrategicRegions: country.primary_culture_homeland_strategic_regions || [],
    interestGroups: country.interest_groups || [],
    definitionFile: country.source?.definition_file || "",
  };
}

function loadLegacyData(data) {
  const dynamicCountryNameVariants = data.dynamic_country_name_variants || [];
  const dynamicCountryMapColorRules = data.dynamic_country_map_color_rules || [];
  const namesByTag = groupBy(dynamicCountryNameVariants, "country_tag");
  const colorsByTag = new Map();
  for (const rule of dynamicCountryMapColorRules) {
    for (const tag of split(rule.referenced_tags)) {
      if (!colorsByTag.has(tag)) colorsByTag.set(tag, []);
      colorsByTag.get(tag).push(rule);
    }
  }
  return {
    meta: {
      ...data.meta,
      default_dynamic_country_name_variant_count: dynamicCountryNameVariants.filter((variant) => variant.scope === "DEFAULT").length,
    },
    countries: (data.countries || []).map((country) => ({
      tag: country.tag,
      name: country.name_zh,
      existsAtStart: country.exists_at_start,
      startingStateCount: Number(country.starting_state_count || 0),
      startingStates: split(country.starting_states),
      startingOverlordTag: country.starting_overlord_tag || "",
      startingOverlordName: "",
      startingSubjectType: country.starting_subject_type || "",
      startingSubjectUsesOverlordColor: country.starting_subject_uses_overlord_color === "是",
      hasHistoryCountryFile: country.has_history_country_file,
      isReleasable: country.is_releasable,
      isFormable: country.is_formable,
      isMajorFormable: country.is_major_formable,
      isMinorFormable: country.is_formable === "是" && country.is_major_formable !== "是" ? "是" : "否",
      isSpecial: "否",
      specialMechanic: "",
      specialTags: [],
      canFormTags: split(country.can_form_tags_by_primary_culture),
      canFormNames: split(country.can_form_names_zh_by_primary_culture),
      primaryCultures: split(country.primary_cultures),
      primaryCulturesZh: split(country.primary_cultures_zh),
      religion: country.religion,
      religionZh: country.religion_zh,
      religionSource: country.religion_source,
      tier: country.tier,
      tierZh: country.tier_zh,
      tierPrestige: country.tier_prestige,
      countryType: country.country_type,
      countryTypeZh: country.country_type_zh,
      colorRgb: split(country.color_rgb).map(Number).filter(Number.isFinite),
      colorHex: country.color_hex,
      primaryUnitColor: country.primary_unit_color,
      secondaryUnitColor: country.secondary_unit_color,
      tertiaryUnitColor: country.tertiary_unit_color,
      capital: country.capital,
      capitalZh: country.capital_zh,
      dynamicNameVariants: namesByTag.get(country.tag) || [],
      usesDefaultDynamicCountryNameVariants: dynamicCountryNameVariants.some((variant) => variant.scope === "DEFAULT"),
      dynamicMapColorRules: colorsByTag.get(country.tag) || [],
      formationRequiredCultures: split(country.formation_required_cultures),
      formationRequiredCulturesZh: split(country.formation_required_cultures_zh),
      formationStates: split(country.formation_states),
      formationStateRegions: [],
      formationStrategicRegions: [],
      locationStateRegions: [],
      locationStrategicRegions: [],
      formationRegion: country.formation_region,
      releaseStates: split(country.release_states),
      primaryCultureTraits: [],
      primaryCultureTraitGroups: [],
      primaryCultureHomelandStateRegions: [],
      primaryCultureHomelandStrategicRegions: [],
      definitionFile: country.definition_file,
    })),
    cultures: data.cultures || [],
    cultureTraits: data.culture_traits || [],
    cultureTraitGroups: data.culture_trait_groups || [],
    stateRegions: data.state_regions || [],
    strategicRegions: data.strategic_regions || [],
    geographicRegions: data.geographic_regions || [],
    interestGroups: data.interest_groups || [],
    interestGroupTraits: data.interest_group_traits || [],
    ideologies: data.ideologies || [],
    dynamicCountryNameVariants,
    dynamicCountryMapColorRules,
    formables: data.formable_countries || [],
    releasables: data.releasable_countries || [],
  };
}

function readJson(file) {
  const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function printHelp() {
  console.log(`Usage: node scripts/build_wiki.mjs [options]

Options:
  --database <path>  Database directory, default database/vic3_1.13.9
  --source <path>    Source index.json, default <database>/index.json
  --out <path>       Output site directory, default site
  --help             Show this help
`);
}

function boolText(value) {
  return value ? "是" : "否";
}

function relatedCulturesByKeys(cultureKeys, currentKey, byKey) {
  return [...new Set(cultureKeys || [])]
    .filter((key) => key && key !== currentKey && byKey.has(key))
    .sort((a, b) => a.localeCompare(b))
    .map((key) => {
      const culture = byKey.get(key);
      return {
        id: `culture:${key}`,
        key,
        name_zh: culture.name_zh || key,
      };
    });
}

function traitToGroupRef(trait) {
  if (!trait?.group_key) return null;
  return {
    id: `culture_trait_group:${trait.group_key}`,
    key: trait.group_key,
    name_zh: trait.group_name_zh || trait.group_key,
    type: trait.type || "",
    type_zh: trait.type_zh || "",
  };
}

function uniqueByKey(items) {
  const result = [];
  const seen = new Set();
  for (const item of items || []) {
    if (!item?.key || seen.has(item.key)) continue;
    seen.add(item.key);
    result.push(item);
  }
  return result;
}

function pushMapSet(map, key, value) {
  if (!key || !value) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

function groupBy(rows, field) {
  const result = new Map();
  for (const row of rows || []) {
    const key = row[field] || "";
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(row);
  }
  return result;
}

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value && !value.startsWith("--")) {
      result[key] = value;
      i += 1;
    } else {
      result[key] = true;
    }
  }
  return result;
}

function split(value) {
  if (!value) return [];
  return String(value)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}
