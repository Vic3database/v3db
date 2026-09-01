import fs from "node:fs";
import path from "node:path";
import { collectLocalizationRefs, sha256Text } from "./lib/localization-schema.mjs";
import { searchAliasFields } from "./search_aliases.mjs";
import { deriveCultureHomelandEffects } from "./culture_homeland_effects.mjs";

const victorianCenturyChangeCollections = [
  ["countries", "tag"],
  ["cultures", "key"],
  ["cultureTraits", "key"],
  ["cultureTraitGroups", "key"],
  ["stateRegions", "key"],
  ["strategicRegions", "key"],
  ["geographicRegions", "key"],
  ["companies", "key"],
  ["companyCharterTypes", "key"],
  ["interestGroups", "key"],
  ["interestGroupTraits", "key"],
  ["ideologies", "key"],
  ["laws", "key"],
  ["lawGroups", "key"],
  ["technologies", "key"],
  ["technologyEras", "key"],
  ["buildings", "key"],
  ["buildingGroups", "key"],
  ["productionMethodGroups", "key"],
  ["productionMethods", "key"],
  ["goods", "key"],
  ["prestigeGoods", "key"],
];

const victorianCenturyChangeIgnoredFields = new Set([
  "id",
  "source",
  "source_file",
  "source_files",
  "sourceFile",
  "definition_file",
  "definitionFile",
  "patch_directives",
  "static_obsessions",
  "starting_obsessions",
  "starting_obsessed_cultures",
  "vc_change_kind",
  "vc_change_fields",
]);

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const databaseDir = path.resolve(args.database || "database/vic3_1.13.9");
const source = path.resolve(args.source || path.join(databaseDir, "index.json"));
const outDir = path.resolve(args.out || path.join("site", "versions", "1.13.9"));
const baselineDatabaseDir = args["baseline-database"] ? path.resolve(args["baseline-database"]) : "";
const baselineSource = baselineDatabaseDir ? path.join(baselineDatabaseDir, "index.json") : "";

if (!fs.existsSync(source)) {
  throw new Error(`找不到数据文件：${source}`);
}
if (baselineSource && !fs.existsSync(baselineSource)) {
  throw new Error(`找不到对比基线数据文件：${baselineSource}`);
}

fs.mkdirSync(outDir, { recursive: true });

const siteData = loadSiteData(source);
registerSiteCountryDisplayNames(siteData);
const baselineData = baselineSource ? loadSiteData(baselineSource) : null;
if (baselineData) registerSiteCountryDisplayNames(baselineData);
const data = stripLegacyLocalizedFields(deriveSiteData(baselineData ? applyVictorianCenturyChangeTags(siteData, baselineData) : siteData));

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
  religions: data.religions,
  laws: data.laws,
  lawGroups: data.lawGroups,
  technologies: data.technologies,
  technologyEras: data.technologyEras,
  achievements: data.achievements,
  buildings: data.buildings,
  buildingGroups: data.buildingGroups,
  productionMethodGroups: data.productionMethodGroups,
  productionMethods: data.productionMethods,
  goods: data.goods,
  prestigeGoods: data.prestigeGoods,
  needsData: {
    current: buildNeedsDataset(data),
    baseline: baselineData ? buildNeedsDataset(baselineData) : null,
  },
  dynamicCountryNameVariants: data.dynamicCountryNameVariants,
  dynamicCountryMapColorRules: data.dynamicCountryMapColorRules,
  formables: data.formables,
  releasables: data.releasables,
  cultureHomelandEffects: deriveCultureHomelandEffects(loadCultureHomelandContent(source)),
};

const dataChunks = {
  country: ["countries", "dynamicCountryNameVariants", "dynamicCountryMapColorRules", "formables", "releasables"],
  culture: ["cultures", "cultureTraits", "cultureTraitGroups"],
  region: ["stateRegions", "strategicRegions", "geographicRegions", "cultureHomelandEffects"],
  company: ["companies", "companyCharterTypes"],
  ideology: ["interestGroups", "interestGroupTraits", "ideologies"],
  law: ["laws", "lawGroups"],
  technology: ["technologies", "technologyEras"],
  achievement: ["achievements"],
  building: ["buildings", "buildingGroups", "productionMethodGroups", "productionMethods"],
  goods: ["goods", "prestigeGoods"],
  religion: ["religions"],
  needs: ["needsData"],
};

const dataChunkFileNames = {
  country: "data-countries.js",
  culture: "data-cultures.js",
  region: "data-regions.js",
  company: "data-companies.js",
  ideology: "data-ideologies.js",
  religion: "data-religions.js",
  law: "data-laws.js",
  technology: "data-technologies.js",
  achievement: "data-achievements.js",
  building: "data-buildings.js",
  goods: "data-goods.js",
  needs: "data-needs.js",
};

const localeChunkDescriptors = Object.fromEntries(["zh-Hans", "en"].map((locale) => [locale, {}]));

function writeLocaleChunk(board, structureFile, structureChunk) {
  const refs = collectLocalizationRefs(structureChunk);
  for (const locale of Object.keys(localeChunkDescriptors)) {
    const messages = Object.fromEntries([...refs].sort().map((key) => [
      key,
      siteData.databaseMessagesByLocale?.[locale]?.[key] || generatedLocalizationValue(structureChunk, key, locale),
    ]));
    const base = structureFile.replace(/^data-/, "locale-").replace(/\.js$/, "");
    const file = `${base}.${locale}.js`;
    const id = `${locale}:${board}:${base}`;
    const source = `window.VIC3_LOCALE_CHUNKS = window.VIC3_LOCALE_CHUNKS || {};\nwindow.VIC3_LOCALE_CHUNKS[${JSON.stringify(id)}] = ${JSON.stringify({ locale, messages })};\n`;
    fs.writeFileSync(path.join(outDir, file), source, "utf8");
    const entry = { id, path: file, sha256: sha256Text(source), missing: Object.values(messages).filter((value) => !value).length };
    const descriptor = localeChunkDescriptors[locale][board] || { files: [], missing: 0 };
    descriptor.files.push(entry);
    descriptor.missing += entry.missing;
    localeChunkDescriptors[locale][board] = descriptor;
  }
}

function generatedLocalizationValue(value, key, locale) {
  if (!value || typeof value !== "object") return "";
  if (value.loc?.name === key) return locale === "en" ? value.name_en || "" : value.name_zh || "";
  for (const child of Object.values(value)) {
    const result = generatedLocalizationValue(child, key, locale);
    if (result) return result;
  }
  return "";
}

for (const [key, keys] of Object.entries(dataChunks)) {
  if (key === "country") continue;
  const chunk = Object.fromEntries(keys.map((field) => [field, wikiData[field] || []]));
  fs.writeFileSync(
    path.join(outDir, dataChunkFileNames[key]),
    `window.VIC3_DATA_CHUNK = ${JSON.stringify(chunk)};\n`,
    "utf8",
  );
  writeLocaleChunk(key, dataChunkFileNames[key], chunk);
}

const countryShardCount = 4;
const countryShardSize = Math.ceil(wikiData.countries.length / countryShardCount);
const countryShardFiles = [];
for (let index = 0; index < countryShardCount; index += 1) {
  const file = `data-countries-${index + 1}.js`;
  countryShardFiles.push(file);
  const chunk = { countries: wikiData.countries.slice(index * countryShardSize, (index + 1) * countryShardSize) };
  fs.writeFileSync(
    path.join(outDir, file),
    `window.VIC3_DATA_CHUNK = ${JSON.stringify(chunk)};\n`,
    "utf8",
  );
  writeLocaleChunk("country", file, chunk);
}
const countryMetaFile = "data-country-meta.js";
countryShardFiles.push(countryMetaFile);
const countryMetaChunk = Object.fromEntries(dataChunks.country.slice(1).map((field) => [field, wikiData[field] || []]));
fs.writeFileSync(
  path.join(outDir, countryMetaFile),
  `window.VIC3_DATA_CHUNK = ${JSON.stringify(countryMetaChunk)};\n`,
  "utf8",
);
writeLocaleChunk("country", countryMetaFile, countryMetaChunk);

const searchSource = `window.VIC3_SEARCH_INDEX = ${JSON.stringify({ locales: ["zh-Hans", "en"], entries: createSearchEntries(wikiData, siteData.databaseMessagesByLocale || {}) })};\n`;
fs.writeFileSync(path.join(outDir, "search-index.js"), searchSource, "utf8");

const dataIndex = {
  meta: wikiData.meta,
  chunks: Object.fromEntries(Object.entries(dataChunks).map(([key, keys]) => [key, {
    files: key === "country" ? countryShardFiles : [dataChunkFileNames[key]],
    keys,
    counts: Object.fromEntries(keys.map((field) => [field, Array.isArray(wikiData[field]) ? wikiData[field].length : 0])),
  }])),
  locales: {
    supported: ["zh-Hans", "en"],
    chunks: localeChunkDescriptors,
    search_index: { path: "search-index.js", sha256: sha256Text(searchSource) },
  },
};

fs.writeFileSync(
  path.join(outDir, "data-index.js"),
  `window.VIC3_DATA_INDEX = ${JSON.stringify(dataIndex)};\n`,
  "utf8",
);
for (const generatedFile of fs.readdirSync(outDir)) {
  if (!/^(?:data-.+|locale-.+|search-index)\.js$/.test(generatedFile)) continue;
  const active = generatedFile === "data-index.js"
    || generatedFile === "search-index.js"
    || countryShardFiles.includes(generatedFile)
    || Object.values(dataChunkFileNames).includes(generatedFile)
    || Object.values(localeChunkDescriptors).some((byBoard) => Object.values(byBoard).some((entry) => entry.files.some((file) => file.path === generatedFile)));
  if (!active) fs.rmSync(path.join(outDir, generatedFile), { force: true });
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
  achievements: wikiData.achievements.length,
  buildings: wikiData.buildings.length,
  goods: wikiData.goods.length,
  prestigeGoods: wikiData.prestigeGoods.length,
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
    const religions = sourceData.files.religions ? readJson(path.join(baseDir, sourceData.files.religions)) : [];
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
    const achievements = sourceData.files.achievements ? readJson(path.join(baseDir, sourceData.files.achievements)) : [];
    const buildings = sourceData.files.buildings ? readJson(path.join(baseDir, sourceData.files.buildings)) : [];
    const buildingGroups = sourceData.files.building_groups ? readJson(path.join(baseDir, sourceData.files.building_groups)) : [];
    const productionMethodGroups = sourceData.files.production_method_groups ? readJson(path.join(baseDir, sourceData.files.production_method_groups)) : [];
    const productionMethods = sourceData.files.production_methods ? readJson(path.join(baseDir, sourceData.files.production_methods)) : [];
    const goods = sourceData.files.goods ? readJson(path.join(baseDir, sourceData.files.goods)) : [];
    const prestigeGoods = sourceData.files.prestige_goods ? readJson(path.join(baseDir, sourceData.files.prestige_goods)) : [];
    const popNeeds = sourceData.files.pop_needs ? readJson(path.join(baseDir, sourceData.files.pop_needs)) : [];
    const buyPackages = sourceData.files.buy_packages ? readJson(path.join(baseDir, sourceData.files.buy_packages)) : [];
    const lawGroups = sourceData.files.law_groups ? readJson(path.join(baseDir, sourceData.files.law_groups)) : [];
    const dynamicCountryNameVariants = readJson(path.join(baseDir, sourceData.files.dynamic_country_name_variants));
    const dynamicCountryMapColorRules = readJson(path.join(baseDir, sourceData.files.dynamic_country_map_color_rules));
    const formables = readJson(path.join(baseDir, sourceData.files.formable_countries));
    const releasables = readJson(path.join(baseDir, sourceData.files.releasable_countries));
    const primaryCultureExpansions = sourceData.files.primary_culture_expansions
      ? readJson(path.join(baseDir, sourceData.files.primary_culture_expansions))
      : { countries: {} };
    const nameById = new Map(dynamicCountryNameVariants.map((variant) => [variant.id, variant]));
    const colorById = new Map(dynamicCountryMapColorRules.map((rule) => [rule.id, rule]));
    const primaryCultureExpansionByTag = new Map(Object.entries(primaryCultureExpansions.countries || {}));
    const databaseMessagesByLocale = Object.fromEntries((sourceData.locales?.supported || []).map((locale) => [
      locale,
      readJson(path.join(baseDir, sourceData.locales.files[locale].file)),
    ]));
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
      countries: countries.map((country) => flattenDatabaseCountry(country, nameById, colorById, primaryCultureExpansionByTag.get(country.tag))),
      religions,
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
      achievements,
      buildings,
      buildingGroups,
      productionMethodGroups,
      productionMethods,
      goods,
      prestigeGoods,
      popNeeds,
      buyPackages,
      dynamicCountryNameVariants,
      dynamicCountryMapColorRules,
      formables,
      releasables,
      databaseMessagesByLocale,
    };
  }
  throw new Error(`Unsupported database schema in ${sourceFile}: expected schema_version and files.`);
}

function loadCultureHomelandContent(sourceFile) {
  const sourceData = readJson(sourceFile);
  const baseDir = path.dirname(sourceFile);
  const contentIndexPath = path.join(baseDir, "content-index.json");
  if (!fs.existsSync(contentIndexPath)) return {};
  const contentIndex = readJson(contentIndexPath);
  const files = contentIndex.files || {};
  const read = (key) => files[key] ? readJson(path.join(baseDir, files[key])) : [];
  return { event: read("events"), journal: read("journal_entries"), decision: read("decisions") };
}

function deriveSiteData(siteData) {
  const visibleGeographicRegions = (siteData.geographicRegions || []).filter((region) => !region.is_current_strategic_region);
  return {
    ...siteData,
    countries: siteData.countries.map(deriveCountryRecord),
    religions: siteData.religions || [],
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
    achievements: siteData.achievements || [],
    buildings: siteData.buildings || [],
    buildingGroups: siteData.buildingGroups || [],
    productionMethodGroups: siteData.productionMethodGroups || [],
    productionMethods: siteData.productionMethods || [],
    goods: siteData.goods || [],
    prestigeGoods: siteData.prestigeGoods || [],
    popNeeds: siteData.popNeeds || [],
    buyPackages: siteData.buyPackages || [],
  };
}

function buildNeedsDataset(siteData) {
  return {
    needs: siteData.popNeeds || [],
    packages: siteData.buyPackages || [],
  };
}

function applyVictorianCenturyChangeTags(siteData, baselineData) {
  const tagged = { ...siteData };
  for (const [field, keyField] of victorianCenturyChangeCollections) {
    tagged[field] = markVictorianCenturyChanges(siteData[field], baselineData[field], keyField, field === "technologies");
  }
  tagged.stateRegions = markVictorianCenturyStateTraitChanges(tagged.stateRegions, baselineData.stateRegions);
  tagged.buildings = markBuildingsWithChangedProductionMethods(tagged.buildings, tagged.productionMethodGroups, tagged.productionMethods);
  tagged.cultures = markVictorianCenturyCultureTraitReferences(tagged.cultures, tagged.cultureTraits, tagged.cultureTraitGroups);
  tagged.countries = markVictorianCenturyCountryTraitReferences(tagged.countries, tagged.cultureTraits, tagged.cultureTraitGroups);
  return tagged;
}

function markBuildingsWithChangedProductionMethods(buildings, productionMethodGroups, productionMethods) {
  const changedMethods = new Set((productionMethods || [])
    .filter((method) => method?.vc_change_kind === "adjusted")
    .map((method) => method.key));
  const changedGroups = new Map((productionMethodGroups || [])
    .map((group) => [group.key, group.production_method_keys || []]));
  return (buildings || []).map((building) => {
    const methodKeys = (building.production_method_group_keys || [])
      .flatMap((groupKey) => changedGroups.get(groupKey) || [])
      .filter((key) => changedMethods.has(key));
    if (!methodKeys.length) return building;
    const fields = [...new Set([...(building.vc_change_fields || []), "production_method_values"])].sort((left, right) => left.localeCompare(right));
    return { ...building, vc_change_kind: building.vc_change_kind || "adjusted", vc_change_fields: fields };
  });
}

function markVictorianCenturyChanges(items, baselineItems, keyField, ignoreTechnologyReferences = false) {
  const baselineByKey = new Map((baselineItems || []).map((item) => [item?.[keyField], item]));
  return (items || []).map((item) => {
    const key = item?.[keyField];
    const baseline = baselineByKey.get(key);
    const kind = !baseline ? "added" : victorianCenturyContentDiffers(item, baseline, ignoreTechnologyReferences) ? "adjusted" : "";
    const fields = kind === "adjusted" ? victorianCenturyChangedFields(item, baseline, ignoreTechnologyReferences) : [];
    return kind ? { ...item, vc_change_kind: kind, ...(fields.length ? { vc_change_fields: fields } : {}) } : item;
  });
}

function markVictorianCenturyStateTraitChanges(stateRegions, baselineStateRegions) {
  const baselineTraits = new Map(collectStateTraits(baselineStateRegions).map((trait) => [trait.key, trait]));
  const changeKinds = new Map(collectStateTraits(stateRegions).map((trait) => {
    const baseline = baselineTraits.get(trait.key);
    const kind = !baseline ? "added" : victorianCenturyContentDiffers(trait, baseline) ? "adjusted" : "";
    return [trait.key, kind];
  }));
  return (stateRegions || []).map((stateRegion) => {
    const traits = (stateRegion.traits || []).map((trait) => {
      const kind = changeKinds.get(trait?.key);
      return kind ? { ...trait, vc_change_kind: kind } : trait;
    });
    return traits.some((trait, index) => trait !== stateRegion.traits?.[index]) ? { ...stateRegion, traits } : stateRegion;
  });
}

function collectStateTraits(stateRegions) {
  const traitsByKey = new Map();
  for (const stateRegion of stateRegions || []) {
    for (const trait of stateRegion.traits || []) {
      if (trait?.key && !traitsByKey.has(trait.key)) traitsByKey.set(trait.key, trait);
    }
  }
  return [...traitsByKey.values()];
}

function markVictorianCenturyCultureTraitReferences(cultures, cultureTraits, cultureTraitGroups) {
  const traitKinds = new Map((cultureTraits || []).map((trait) => [trait.key, trait.vc_change_kind || ""]));
  const groupKinds = new Map((cultureTraitGroups || []).map((group) => [group.key, group.vc_change_kind || ""]));
  return (cultures || []).map((culture) => ({
    ...culture,
    heritage: markVictorianCenturyReference(culture.heritage, traitKinds),
    language: markVictorianCenturyReference(culture.language, traitKinds),
    traditions: markVictorianCenturyReferences(culture.traditions, traitKinds),
    traits: markVictorianCenturyReferences(culture.traits, traitKinds),
    trait_groups: markVictorianCenturyReferences(culture.trait_groups, groupKinds),
  }));
}

function markVictorianCenturyCountryTraitReferences(countries, cultureTraits, cultureTraitGroups) {
  const traitKinds = new Map((cultureTraits || []).map((trait) => [trait.key, trait.vc_change_kind || ""]));
  const groupKinds = new Map((cultureTraitGroups || []).map((group) => [group.key, group.vc_change_kind || ""]));
  return (countries || []).map((country) => ({
    ...country,
    primaryCultureTraits: markVictorianCenturyReferences(country.primaryCultureTraits, traitKinds),
    primaryCultureTraitGroups: markVictorianCenturyReferences(country.primaryCultureTraitGroups, groupKinds),
  }));
}

function markVictorianCenturyReferences(items, changeKinds) {
  return (items || []).map((item) => markVictorianCenturyReference(item, changeKinds));
}

function markVictorianCenturyReference(item, changeKinds) {
  const kind = changeKinds.get(item?.key);
  return kind ? { ...item, vc_change_kind: kind } : item;
}

function victorianCenturyContentDiffers(current, baseline, ignoreTechnologyReferences = false) {
  return stableJson(victorianCenturyComparableValue(current, ignoreTechnologyReferences)) !== stableJson(victorianCenturyComparableValue(baseline, ignoreTechnologyReferences));
}

function victorianCenturyChangedFields(current, baseline, ignoreTechnologyReferences = false) {
  const currentComparable = victorianCenturyComparableValue(current, ignoreTechnologyReferences);
  const baselineComparable = victorianCenturyComparableValue(baseline, ignoreTechnologyReferences);
  return [...new Set([...Object.keys(currentComparable || {}), ...Object.keys(baselineComparable || {})])]
    .filter((key) => stableJson(currentComparable?.[key]) !== stableJson(baselineComparable?.[key]))
    .sort((left, right) => left.localeCompare(right));
}

function victorianCenturyComparableValue(value, ignoreTechnologyReferences = false) {
  if (Array.isArray(value)) return value.map((item) => victorianCenturyComparableValue(item, ignoreTechnologyReferences));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !victorianCenturyChangeIgnoredFields.has(key) && !(ignoreTechnologyReferences && key === "references"))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, victorianCenturyComparableValue(item, ignoreTechnologyReferences)]));
}

function stableJson(value) {
  return JSON.stringify(value);
}

function deriveCountryRecord(country) {
  const displayName = ["BIC", "DEI"].includes(country.tag) ? `country:${country.tag}.displayName` : "";
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
    loc: displayName ? { ...country.loc, displayName } : country.loc,
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

function registerSiteCountryDisplayNames(data) {
  const messages = data?.databaseMessagesByLocale;
  if (!messages) return;
  const values = {
    "zh-Hans": {
      "country:BIC.displayName": "东印度（英属）",
      "country:DEI.displayName": "东印度（荷属）",
    },
    en: {
      "country:BIC.displayName": "East India (British)",
      "country:DEI.displayName": "East India (Dutch)",
    },
  };
  for (const [locale, entries] of Object.entries(values)) {
    messages[locale] = { ...(messages[locale] || {}), ...entries };
  }
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

function flattenDatabaseCountry(country, nameById, colorById, primaryCultureExpansion = null) {
  const dynamicNameVariants = (country.dynamic_country_name_variant_ids || [])
    .map((id) => nameById.get(id))
    .filter(Boolean);
  const dynamicMapColorRules = (country.dynamic_map_color_rule_ids || [])
    .map((id) => colorById.get(id))
    .filter(Boolean);
  const primaryCultures = (country.primary_cultures || []).map((culture) => culture.key);
  const maximumPrimaryCultures = primaryCultureExpansion && Object.prototype.hasOwnProperty.call(primaryCultureExpansion, "maximum_primary_cultures")
    ? primaryCultureExpansion.maximum_primary_cultures
    : primaryCultures;
  const maximumPrimaryCultureSets = primaryCultureExpansion && Object.prototype.hasOwnProperty.call(primaryCultureExpansion, "maximum_primary_culture_sets")
    ? primaryCultureExpansion.maximum_primary_culture_sets
    : [primaryCultures];
  const primaryCultureExpansionPaths = primaryCultureExpansion?.paths || [];
  const primaryCultureConditionalPaths = primaryCultureExpansion?.conditional_primary_culture_paths || [];
  const primaryCultureReplacementPaths = primaryCultureExpansion?.primary_culture_replacements || [];
  const primaryCultureOptionGroups = primaryCultureExpansion?.primary_culture_option_groups || [];
  return {
    id: country.id,
    key: country.tag,
    loc: country.loc,
    tag: country.tag,
    existsAtStart: boolText(country.status?.exists_at_start),
    startingStateCount: (country.starting_states || []).length,
    startingStates: (country.starting_states || []).map((state) => state.key),
    startingOverlordTag: country.starting_subject?.overlord_tag || "",
    startingSubjectType: country.starting_subject?.type || "",
    startingSubjectUsesOverlordColor: Boolean(country.starting_subject?.uses_overlord_color),
    startingTechnologyTier: country.starting_technology_tier == null ? null : Number(country.starting_technology_tier),
    startingTechnologyTemplate: country.starting_technology_template || "",
    startingTechnologyEras: country.starting_technology_eras || [],
    startingTechnologyTemplateTechnologies: country.starting_technology_template_technologies || [],
    startingTechnologies: country.starting_technologies || [],
    startingLaws: country.starting_laws || [],
    startingDiplomacy: (country.starting_diplomacy || []).map((item) => ({
      ...item,
      targetTag: item.target_tag || item.target?.key || "",
      targetName: item.target?.loc?.name || "",
    })),
    hasHistoryCountryFile: boolText(country.status?.has_history_country_file),
    isReleasable: boolText(country.status?.is_releasable),
    isFormable: boolText(country.status?.is_formable),
    isMajorFormable: boolText(country.status?.is_major_formable),
    isMinorFormable: boolText(country.status?.is_formable && !country.status?.is_major_formable),
    isSpecial: boolText(country.special_mechanic?.is_special),
    specialMechanic: country.special_mechanic?.loc?.name || "",
    specialTags: country.special_mechanic?.tags || [],
    canFormTags: (country.can_form_by_primary_culture || []).map((target) => target.tag),
    primaryCultures,
    maximumPrimaryCultures,
    maximumPrimaryCultureSets,
    hasPrimaryCultureExpansions: Boolean(primaryCultureExpansionPaths.length || primaryCultureConditionalPaths.length || primaryCultureReplacementPaths.length),
    primaryCultureExpansionPaths,
    primaryCultureConditionalPaths,
    primaryCultureReplacementPaths,
    primaryCultureOptionGroups,
    religion: country.religion?.key || "",
    religionSource: country.religion?.source || "",
    tier: country.classification?.tier || "",
    tierLoc: country.classification?.loc?.tier || "",
    tierPrestige: String(country.classification?.tier_prestige ?? ""),
    countryType: country.classification?.country_type || "",
    countryTypeLoc: country.classification?.loc?.countryType || "",
    colorRgb: country.color?.rgb || [],
    colorHex: country.color?.hex || "",
    primaryUnitColor: country.unit_colors?.primary || "",
    secondaryUnitColor: country.unit_colors?.secondary || "",
    tertiaryUnitColor: country.unit_colors?.tertiary || "",
    capital: country.capital?.key || "",
    dynamicNameVariants,
    usesDefaultDynamicCountryNameVariants: Boolean(country.uses_default_dynamic_country_name_variants),
    dynamicMapColorRules,
    formationRequiredCultures: (country.formation?.required_cultures || []).map((culture) => culture.key),
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

function readJson(file) {
  const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function createSearchEntries(data, messagesByLocale) {
  const collections = [
    ["country", "countries", "tag"],
    ["culture", "cultures", "key"],
    ["region", "stateRegions", "key"],
    ["company", "companies", "key"],
    ["ideology", "ideologies", "key"],
    ["religion", "religions", "key"],
    ["law", "laws", "key"],
    ["technology", "technologies", "key"],
    ["achievement", "achievements", "key"],
    ["cultureTrait", "cultureTraits", "key"],
    ["interestGroup", "interestGroups", "key"],
    ["interestGroupTrait", "interestGroupTraits", "key"],
    ["strategicRegion", "strategicRegions", "key"],
    ["geographicRegion", "geographicRegions", "key"],
    ["building", "buildings", "key"],
    ["goods", "goods", "key"],
    ["prestigeGood", "prestigeGoods", "key"],
    ["productionMethodGroup", "productionMethodGroups", "key"],
    ["productionMethod", "productionMethods", "key"],
  ];
  const indexedCollections = collections.flatMap(([kind, collection, keyField]) => (data[collection] || []).map((item) => {
    const key = item[keyField] || item.key || item.tag || "";
    const id = item.id || `${kind}:${key}`;
    const message = item.loc?.displayName || item.loc?.name || "";
    const names = {
      "zh-Hans": messagesByLocale["zh-Hans"]?.[message] || key,
      en: messagesByLocale.en?.[message] || item.name_en || key,
    };
    return {
      kind,
      id,
      key,
      names,
      ...searchAliasFields(kind, item, messagesByLocale, names),
    };
  }));
  const interestGroupFlavors = new Map();
  const addInterestGroupFlavor = ({ groupKey, flavorKey, nameMessage, countryTag = "" }) => {
    if (!groupKey || !flavorKey) return;
    const identity = `${groupKey}:${flavorKey}`;
    const flavor = interestGroupFlavors.get(identity) || {
      kind: "interestGroupFlavor",
      id: `interestGroupFlavor:${groupKey}:${flavorKey}`,
      key: flavorKey,
      navigationKey: identity,
      interestGroupKey: groupKey,
      countryTags: [],
      names: {
        "zh-Hans": messagesByLocale["zh-Hans"]?.[nameMessage] || flavorKey,
        en: messagesByLocale.en?.[nameMessage] || flavorKey,
      },
    };
    if (countryTag) flavor.countryTags.push(countryTag);
    interestGroupFlavors.set(identity, flavor);
  };
  for (const group of data.interestGroups || []) {
    for (const flavor of [...(group.condition_variants || []), ...(group.potential_flavors || [])]) {
      addInterestGroupFlavor({
        groupKey: group.key,
        flavorKey: flavor.key,
        nameMessage: flavor.loc?.name || "",
      });
    }
  }
  for (const country of data.countries || []) {
    for (const group of country.interestGroups || []) {
      if (!group.display_name?.is_flavored) continue;
      const flavorKey = group.display_name.key || group.key;
      const nameMessage = group.display_name?.loc?.name || group.loc?.displayName || group.loc?.name || "";
      addInterestGroupFlavor({ groupKey: group.key, flavorKey, nameMessage, countryTag: country.tag });
    }
  }
  const aggregatedInterestGroupFlavors = [...interestGroupFlavors.values()]
    .map((flavor) => ({ ...flavor, countryTags: [...new Set(flavor.countryTags)].sort() }));
  return [...indexedCollections, ...aggregatedInterestGroupFlavors];
}

function printHelp() {
  console.log(`Usage: node scripts/build_wiki.mjs [options]

Options:
  --database <path>  Database directory, default database/vic3_1.13.9
  --source <path>    Source index.json, default <database>/index.json
  --baseline-database <path>  Compare against this database and tag added or adjusted records
  --out <path>       Output site directory, default site/versions/1.13.9
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
        loc: culture.loc || { name: `culture:${key}.name` },
      };
    });
}

function traitToGroupRef(trait) {
  if (!trait?.group_key) return null;
  return {
    id: `culture_trait_group:${trait.group_key}`,
    key: trait.group_key,
    type: trait.type || "",
    loc: { name: `culture_trait_group:${trait.group_key}.name`, type: `culture_trait_group:${trait.group_key}.type` },
  };
}

function stripLegacyLocalizedFields(value) {
  const legacyFieldPattern = /(?:^|_)(?:zh|en)$/i;
  const legacyCamelFields = new Set([
    "tierZh", "countryTypeZh", "capitalZh", "religionZh", "primaryCulturesZh", "formationRequiredCulturesZh",
    "canFormNames", "startingOverlordName",
  ]);
  if (Array.isArray(value)) return value.map(stripLegacyLocalizedFields);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !legacyFieldPattern.test(key) && !legacyCamelFields.has(key))
    .map(([key, item]) => [key, stripLegacyLocalizedFields(item)]));
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
