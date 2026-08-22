import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DIRECT_EFFECT = /\badd_primary_culture\s*=\s*cu:([A-Za-z0-9_]+)/gi;
const REMOVE_EFFECT = /\bremove_primary_culture\s*=\s*cu:([A-Za-z0-9_]+)/gi;
const DANUBIAN_FEDERATION_EFFECT = /\bdanubian_federation_integrate_culture\s*=\s*\{[\s\S]*?\bCULTURE\s*=\s*cu:([A-Za-z0-9_]+)/gi;

// These rows receive their country scope through an on-action, journal-entry chain, or scripted button.
// They are intentionally reviewed here instead of inferred from a broad content group.
const REVIEWED_COUNTRY_SCOPES = Object.freeze({
  "event:acw_je_events.3": ["CSA", "FSA", "USA"],
  "event:austria_federation.3": ["AUS"],
  "event:austria_federation.4": ["AUS"],
  "event:austria_federation.5": ["AUS"],
  "event:austria_federation.6": ["AUS"],
  "event:austria_federation.7": ["AUS"],
  "event:austria_federation.8": ["AUS"],
  "event:austria_federation.9": ["AUS"],
  "event:austria_federation.10": ["AUS"],
  "event:austria_federation.11": ["AUS"],
  "event:austria_federation.12": ["AUS"],
  "event:fsa_events.1": ["FSA", "USA"],
  "event:hokkaido_events.6": ["JAP"],
  "event:algeria_events.8": ["ALD"],
  "event:philippines.2": ["PHI"],
  "event:philippines.3": ["PHI"],
  "event:joi_flavor_expand.4": ["GER"],
  "event:joi_flavor_gbr.92": ["GBR"],
  "event:la_plata.2": ["PLT"],
  "event:joi_flavor_rus.12": ["RUS"],
  "event:joi_flavor_tur.75": ["TUR"],
  "event:joi_flavor_usa.10": ["USA"],
  "journal:american_reconstraction": ["USA"],
});

// These effects act on a country other than the content root. Keeping the country/culture
// pair explicit prevents a broad content scope from assigning the culture to the wrong tag.
const REVIEWED_EFFECT_TARGETS = Object.freeze({
  "event:austria_trialism.3": [
    { country: "CRO", culture: "serb" },
    { country: "CRO", culture: "slovene" },
  ],
  "event:caucasuswar.7": [{ country: "CIR", culture: "north_caucasian" }],
  "event:caucasuswar.9": [{ country: "CIR", culture: "north_caucasian" }],
  "event:culture_south_america.1": [
    { country: "ARG", culture: "argentine" },
    { country: "PEU", culture: "peruvian" },
    { country: "NPU", culture: "peruvian" },
    { country: "SPU", culture: "peruvian" },
    { country: "BOL", culture: "bolivian" },
    { country: "ECU", culture: "ecuadorian" },
    { country: "CHL", culture: "chilean" },
    { country: "VNZ", culture: "venezuelan" },
    { country: "URU", culture: "uruguayan" },
    { country: "PRG", culture: "paraguayan" },
    { country: "CLM", culture: "colombian" },
  ],
  "event:galicia_formation.1": [{ country: "GAL", culture: "galician" }],
  "event:lusofonia.3": [{ country: "BRZ", culture: "portuguese" }],
  "event:mughal.7": [
    { country: "MUG", culture: "avadhi" },
    { country: "MUG", culture: "bengali" },
    { country: "MUG", culture: "kannada" },
    { country: "MUG", culture: "sindi" },
  ],
  "event:joi_flavor_rus.4": [{ country: "TRH", culture: "russian" }],
  "event:joi_flavor_rus.34": [{ country: "MGL", culture: "russian" }],
  "event:zanzibar.1": [{ country: "ZAN", culture: "bedouin" }],
  "event:zanzibar.6": [{ country: "ZAN", culture: "swahili" }],
  "journal:je_cuba_espanol": [{ country: "SPA", culture: "caribeno" }],
  "journal:je_cuba_independencia": [{ country: "CUB", culture: "afro_caribeno" }],
  "journal:je_iberia": [{ country: "IBE", culture: "iberian" }],
  "journal:je_philippines_main": [{ country: "PHI", culture: "filipino_mestizo" }],
});

// These effects are defined in scripted buttons, on-actions, amendments, or scripted effects
// that are not represented as event/journal/decision rows in the extracted database.  Keep each
// record explicit so the generated data remains source-traceable and does not infer a country
// from a broad content group.
const REVIEWED_SCRIPTED_PATHS = Object.freeze([
  { country: "AFG", culture: "kho", content_id: "on_country_formed:afghanistan_origin", effect_kind: "on_action", source_file: "common/on_actions/00_code_on_actions.txt", source_line: 4083 },
  { country: "AFG", culture: "turkmen", content_id: "on_country_formed:afghanistan_origin", effect_kind: "on_action", source_file: "common/on_actions/00_code_on_actions.txt", source_line: 4077 },
  { country: "AFG", culture: "uzbek", content_id: "on_country_formed:afghanistan_origin", effect_kind: "on_action", source_file: "common/on_actions/00_code_on_actions.txt", source_line: 4070 },
  { country: "AFG", culture: "uzbek", content_id: "on_country_formed:afghanistan_origin", effect_kind: "on_action", source_file: "common/on_actions/00_code_on_actions.txt", source_line: 4076 },
  { country: "BHT", culture: "assamese", content_id: "grant_indian_cultures", effect_kind: "scripted_effect", source_file: "common/scripted_effects/00_victoria_scripted_effects.txt", source_line: 5056 },
  { country: "BHT", culture: "avadhi", content_id: "grant_indian_cultures", effect_kind: "scripted_effect", source_file: "common/scripted_effects/00_victoria_scripted_effects.txt", source_line: 5056 },
  { country: "BHT", culture: "bengali", content_id: "grant_indian_cultures", effect_kind: "scripted_effect", source_file: "common/scripted_effects/00_victoria_scripted_effects.txt", source_line: 5056 },
  { country: "BHT", culture: "bihari", content_id: "grant_indian_cultures", effect_kind: "scripted_effect", source_file: "common/scripted_effects/00_victoria_scripted_effects.txt", source_line: 5056 },
  { country: "BHT", culture: "gujarati", content_id: "grant_indian_cultures", effect_kind: "scripted_effect", source_file: "common/scripted_effects/00_victoria_scripted_effects.txt", source_line: 5056 },
  { country: "BHT", culture: "kannada", content_id: "grant_indian_cultures", effect_kind: "scripted_effect", source_file: "common/scripted_effects/00_victoria_scripted_effects.txt", source_line: 5056 },
  { country: "BHT", culture: "malayalam", content_id: "grant_indian_cultures", effect_kind: "scripted_effect", source_file: "common/scripted_effects/00_victoria_scripted_effects.txt", source_line: 5056 },
  { country: "BHT", culture: "marathi", content_id: "grant_indian_cultures", effect_kind: "scripted_effect", source_file: "common/scripted_effects/00_victoria_scripted_effects.txt", source_line: 5056 },
  { country: "BHT", culture: "oriya", content_id: "grant_indian_cultures", effect_kind: "scripted_effect", source_file: "common/scripted_effects/00_victoria_scripted_effects.txt", source_line: 5056 },
  { country: "BHT", culture: "panjabi", content_id: "grant_indian_cultures", effect_kind: "scripted_effect", source_file: "common/scripted_effects/00_victoria_scripted_effects.txt", source_line: 5056 },
  { country: "BHT", culture: "rajput", content_id: "grant_indian_cultures", effect_kind: "scripted_effect", source_file: "common/scripted_effects/00_victoria_scripted_effects.txt", source_line: 5056 },
  { country: "BHT", culture: "sindi", content_id: "grant_indian_cultures", effect_kind: "scripted_effect", source_file: "common/scripted_effects/00_victoria_scripted_effects.txt", source_line: 5056 },
  { country: "BHT", culture: "tamil", content_id: "grant_indian_cultures", effect_kind: "scripted_effect", source_file: "common/scripted_effects/00_victoria_scripted_effects.txt", source_line: 5056 },
  { country: "BHT", culture: "telegu", content_id: "grant_indian_cultures", effect_kind: "scripted_effect", source_file: "common/scripted_effects/00_victoria_scripted_effects.txt", source_line: 5056 },
  { country: "BHT", culture: "kashmiri", content_id: "india_home_rule_events.1:south_asian_homelands", effect_kind: "event", source_file: "events/india_events/india_home_rule_events.txt", source_line: 30 },
  { country: "BHT", culture: "nepali", content_id: "india_home_rule_events.1:south_asian_homelands", effect_kind: "event", source_file: "events/india_events/india_home_rule_events.txt", source_line: 30 },
  { country: "BHT", culture: "sinhala", content_id: "india_home_rule_events.1:south_asian_homelands", effect_kind: "event", source_file: "events/india_events/india_home_rule_events.txt", source_line: 30 },
  { country: "CEY", culture: "sinhala", content_id: "on_become_independent:ceylon", effect_kind: "on_action", source_file: "common/on_actions/00_code_on_actions.txt", source_line: 7632 },
  { country: "IBE", culture: "portuguese", content_id: "scripted_button:iberia_formation", effect_kind: "scripted_button", source_file: "common/scripted_buttons/06_iberia_buttons.txt", source_line: 112 },
  { country: "IBE", culture: "spanish", content_id: "scripted_button:iberia_formation", effect_kind: "scripted_button", source_file: "common/scripted_buttons/06_iberia_buttons.txt", source_line: 104 },
  { country: "FRA", culture: "breton", content_id: "scripted_button:je_vernacular_policy_accept_breton_button", effect_kind: "scripted_button", source_file: "common/scripted_buttons/06_vernacular_buttons.txt", source_line: 571 },
  { country: "FRA", culture: "francoprovencal", content_id: "scripted_button:je_vernacular_policy_accept_francoprovencal_button", effect_kind: "scripted_button", source_file: "common/scripted_buttons/06_vernacular_buttons.txt", source_line: 489 },
  { country: "FRA", culture: "occitan", content_id: "scripted_button:je_vernacular_policy_accept_occitan_button", effect_kind: "scripted_button", source_file: "common/scripted_buttons/06_vernacular_buttons.txt", source_line: 647 },
  { country: "FRA", culture: "wallonian", content_id: "scripted_button:je_vernacular_policy_accept_wallonian_button", effect_kind: "scripted_button", source_file: "common/scripted_buttons/06_vernacular_buttons.txt", source_line: 724 },
  { country: "PLT", culture: "guarani", content_id: "on_country_formed:paraguay_origin", effect_kind: "on_action", source_file: "common/on_actions/00_code_on_actions.txt", source_line: 3901 },
  { country: "SAF", culture: "boer", content_id: "scripted_button:saf_highveld_add_boer_as_primary_button", effect_kind: "scripted_button", source_file: "common/scripted_buttons/05_struggle_for_the_highveld_buttons.txt", source_line: 148 },
  { country: "SAF", culture: "griqua", content_id: "scripted_button:saf_highveld_add_griqua_as_primary_button", effect_kind: "scripted_button", source_file: "common/scripted_buttons/05_struggle_for_the_highveld_buttons.txt", source_line: 194 },
  { country: "SPA", culture: "aragonese", content_id: "scripted_button:je_vernacular_policy_accept_aragonese_button", effect_kind: "scripted_button", source_file: "common/scripted_buttons/06_vernacular_buttons.txt", source_line: 149 },
  { country: "SPA", culture: "asturleonese", content_id: "scripted_button:je_vernacular_policy_accept_asturleonese_button", effect_kind: "scripted_button", source_file: "common/scripted_buttons/06_vernacular_buttons.txt", source_line: 223 },
  { country: "SPA", culture: "basque", content_id: "scripted_button:je_vernacular_policy_accept_basque_button", effect_kind: "scripted_button", source_file: "common/scripted_buttons/06_vernacular_buttons.txt", source_line: 399 },
  { country: "SPA", culture: "catalan", content_id: "scripted_button:je_vernacular_policy_accept_catalan_button", effect_kind: "scripted_button", source_file: "common/scripted_buttons/06_vernacular_buttons.txt", source_line: 80 },
  { country: "SPA", culture: "galician", content_id: "scripted_button:je_vernacular_policy_accept_galician_button", effect_kind: "scripted_button", source_file: "common/scripted_buttons/06_vernacular_buttons.txt", source_line: 306 },
  { country: "SPA", culture: "basque", content_id: "amendment_reinstated_fueros", effect_kind: "amendment", source_file: "common/amendments/00_amendments_content_04.txt", source_line: 152 },
  { country: "IBE", culture: "catalan", content_id: "on_country_formed:spain_accepted_cultures", effect_kind: "on_action", source_file: "common/on_actions/00_code_on_actions.txt", source_line: 4114 },
  { country: "IBE", culture: "aragonese", content_id: "on_country_formed:spain_accepted_cultures", effect_kind: "on_action", source_file: "common/on_actions/00_code_on_actions.txt", source_line: 4114 },
  { country: "IBE", culture: "asturleonese", content_id: "on_country_formed:spain_accepted_cultures", effect_kind: "on_action", source_file: "common/on_actions/00_code_on_actions.txt", source_line: 4114 },
  { country: "IBE", culture: "galician", content_id: "on_country_formed:spain_accepted_cultures", effect_kind: "on_action", source_file: "common/on_actions/00_code_on_actions.txt", source_line: 4114 },
  { country: "IBE", culture: "basque", content_id: "on_country_formed:spain_accepted_cultures", effect_kind: "on_action", source_file: "common/on_actions/00_code_on_actions.txt", source_line: 4114 },
  { country: "SPA", culture: "caribeno", content_id: "cuba_annex_effects", effect_kind: "scripted_effect", source_file: "common/scripted_effects/00_chris_scripted_effects.txt", source_line: 1 },
  { country: "PHI", culture: "filipino_mestizo", content_id: "on_become_independent:philippines", effect_kind: "on_action", source_file: "common/on_actions/00_code_on_actions.txt", source_line: 7678 },
]);

// Each option group describes mutually exclusive country-level outcomes. The generator
// preserves every attainable maximum set instead of combining cultures from opposing routes.
const PRIMARY_CULTURE_OPTION_GROUPS = Object.freeze({
  AFG: [
    {
      id: "afghanistan_origin",
      source_contents: ["on_action:on_country_formed:afghanistan_origin"],
      options: [
        { id: "kunduz", added_primary_cultures: ["uzbek"] },
        { id: "maimana", added_primary_cultures: ["turkmen", "uzbek"] },
        { id: "kabul", added_primary_cultures: ["kho"] },
      ],
    },
  ],
  GBR: [
    {
      id: "british_relocation",
      source_contents: ["event:joi_flavor_gbr.92"],
      options: [
        { id: "canada", added_primary_cultures: ["anglo_canadian"] },
        { id: "australia", added_primary_cultures: ["australian"] },
      ],
    },
  ],
  SAF: [
    {
      id: "highveld_culture_choice",
      source_contents: [
        "scripted:scripted_button:saf_highveld_add_boer_as_primary_button",
        "scripted:scripted_button:saf_highveld_add_griqua_as_primary_button",
      ],
      options: [
        { id: "boer", added_primary_cultures: ["boer"] },
        { id: "griqua", added_primary_cultures: ["griqua"] },
      ],
    },
  ],
});

const CONDITIONAL_EFFECTS = Object.freeze([
  {
    scope_key: "event:boxer_rebellion_events.4",
    added_culture: "han",
    removed_culture: "manchu",
    eligible_when: { primary_cultures_any: ["han", "manchu"] },
  },
  {
    scope_key: "event:andean_federation.2",
    added_culture: "platinean",
    country_tags: ["GCO", "PBC", "PLT"],
    eligible_when: { was_formed_from_any: ["PLT"] },
  },
  {
    scope_key: "on_action:on_country_formed:paraguay_origin",
    added_culture: "guarani",
    country_tags: ["PLT"],
    eligible_when: { was_formed_from_any: ["PRG"] },
  },
]);

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log("Usage: node scripts/primary_culture_expansions.mjs --database <directory>");
  process.exit(0);
}

const database = path.resolve(args.database || path.join(ROOT, "database", "vic3_1.13.11"));
const indexFile = path.join(database, "index.json");
const index = readJson(indexFile);
const countries = readDatabaseCollection(index, database, "countries");
const cultures = readDatabaseCollection(index, database, "cultures");
const validCountryTags = new Set(countries.map((country) => String(country?.tag || country?.id || "").toUpperCase()).filter(Boolean));
const validCultureKeys = new Set(cultures.map((culture) => String(culture?.key || "")).filter(Boolean));
const countryStartingCultures = new Map(countries.map((country) => [
  String(country?.tag || country?.id || "").toUpperCase(),
  uniqueSorted((country?.primary_cultures || []).map((culture) => culture?.key).filter((key) => validCultureKeys.has(key))),
]));

const pathsByCountry = new Map();
const replacementsByCountry = new Map();
const unresolvedEffects = [];
const conditionalEffects = [];
for (const scripted of REVIEWED_SCRIPTED_PATHS) {
  if (!validCountryTags.has(scripted.country) || !validCultureKeys.has(scripted.culture)) continue;
  const conditional = conditionalFor(`on_action:${scripted.content_id}`, scripted.culture);
  if (conditional && scripted.content_id === "on_country_formed:paraguay_origin") {
    recordConditional(conditional, scripted);
    continue;
  }
  addPath(pathsByCountry, scripted.country, makeReviewedPath(scripted));
}
for (const [contentType, filename] of Object.entries(contentFiles(index))) {
  const rows = readJson(path.join(database, filename));
  for (const row of rows) {
    if (row?.content_class && row.content_class !== "game") continue;
    const contentId = String(row?.id || row?.script_key || row?.key || "");
    if (!contentId) continue;
    const effects = extractEffects(executableRaw(String(row?.raw || "")));
    if (!effects.length) continue;
    const scopeKey = `${contentType}:${contentId}`;
    const tags = countryScopeFor(row, scopeKey, validCountryTags);
    const reviewedTargets = reviewedTargetsFor(scopeKey, effects, validCountryTags);
    const replacements = replacementsFor(row, scopeKey, effects, tags, reviewedTargets, validCultureKeys);
    for (const effect of effects) {
      const conditional = conditionalFor(scopeKey, effect.culture);
      if (conditional && !conditional.country_tags) {
        recordConditional(conditional, {
          content_type: contentType,
          content_id: contentId,
          source_file: String(row?.source_file || ""),
          source_line: Number(row?.source_line || 0),
        });
      }
    }
    const replacementSignatures = new Set(replacements.map((replacement) => replacementSignature(replacement.country, replacement.effect)));
    const mappedEffects = new Set();
    for (const tag of tags) {
      for (const effect of effects) {
        if (!validCultureKeys.has(effect.culture)) continue;
        const conditional = conditionalFor(scopeKey, effect.culture);
        if (conditional) {
          mappedEffects.add(effectSignature(effect));
          if (conditional.country_tags?.includes(tag)) {
            recordConditional(conditional, {
              content_type: contentType,
              content_id: contentId,
              source_file: String(row?.source_file || ""),
              source_line: Number(row?.source_line || 0),
            });
          }
          continue;
        }
        if (replacementSignatures.has(replacementSignature(tag, effect))) continue;
        addPath(pathsByCountry, tag, makePathRecord(contentType, contentId, row, effect));
        mappedEffects.add(effectSignature(effect));
      }
    }
    for (const target of reviewedTargets) {
      if (replacementSignatures.has(replacementSignature(target.country, target.effect))) continue;
      addPath(pathsByCountry, target.country, makePathRecord(contentType, contentId, row, target.effect));
      mappedEffects.add(effectSignature(target.effect));
    }
    for (const replacement of replacements) {
      addReplacement(replacementsByCountry, replacement.country, makeReplacementRecord(contentType, contentId, row, replacement));
      mappedEffects.add(effectSignature(replacement.effect));
    }
    const unresolved = effects.filter((effect) => validCultureKeys.has(effect.culture)
      && !conditionalFor(scopeKey, effect.culture)
      && !mappedEffects.has(effectSignature(effect)));
    if (unresolved.length) unresolvedEffects.push(makeUnresolvedEffect(contentType, contentId, row, unresolved));
  }
}

const countryRecords = Object.fromEntries(uniqueSorted([...pathsByCountry.keys(), ...replacementsByCountry.keys()])
  .map((tag) => {
    const paths = pathsByCountry.get(tag) || [];
    return [tag, buildCountryRecord(tag, paths, replacementsByCountry.get(tag) || [], countryStartingCultures.get(tag) || [], optionGroupsFor(tag, paths))];
  })
  .filter(([, record]) => record.paths.length > 0 || record.added_primary_cultures.length > 0 || record.primary_culture_replacements.length > 0 || record.primary_culture_option_groups.length > 0)
);

const result = {
  schema_version: 1,
  methodology: "maximum_reachable_union",
  countries: countryRecords,
  conditional_effects: conditionalEffects.sort(compareConditionalEffect),
  unresolved_effects: unresolvedEffects.sort(compareUnresolvedEffect),
};

const outputFile = path.join(database, "primary_culture_expansions.json");
fs.writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`, "utf8");
index.files = { ...index.files, primary_culture_expansions: "primary_culture_expansions.json" };
fs.writeFileSync(indexFile, `${JSON.stringify(index, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  primary_culture_expansions: "ok",
  database,
  countries: Object.keys(countryRecords).length,
  paths: Object.values(countryRecords).reduce((total, record) => total + record.paths.length, 0),
  unresolved_effects: result.unresolved_effects.length,
}, null, 2));

function contentFiles(indexData) {
  const files = indexData?.files || {};
  return Object.fromEntries([
    ["event", files.events || "events.json"],
    ["journal", files.journal_entries || "journal_entries.json"],
    ["decision", files.decisions || "decisions.json"],
  ].filter(([, filename]) => filename));
}

function countryScopeFor(row, scopeKey, validTags) {
  const reviewed = REVIEWED_COUNTRY_SCOPES[scopeKey];
  const candidates = reviewed || row?.country_scope || [];
  return uniqueSorted(candidates.map((tag) => String(tag || "").toUpperCase()).filter((tag) => validTags.has(tag)));
}

function reviewedTargetsFor(scopeKey, effects, validTags) {
  const effectsByCulture = new Map(effects.map((effect) => [effect.culture, effect]));
  return (REVIEWED_EFFECT_TARGETS[scopeKey] || [])
    .map((target) => ({
      country: String(target.country || "").toUpperCase(),
      effect: effectsByCulture.get(target.culture),
    }))
    .filter((target) => validTags.has(target.country) && target.effect);
}

function replacementsFor(row, scopeKey, effects, tags, reviewedTargets, validCultureKeys) {
  const replacements = extractReplacements(String(row?.raw || ""));
  if (!replacements.length) return [];
  return replacements.flatMap((replacement) => {
    if (!validCultureKeys.has(replacement.added_culture) || !validCultureKeys.has(replacement.removed_culture)) return [];
    const effect = effects.find((item) => item.kind === "add_primary_culture" && item.culture === replacement.added_culture);
    if (!effect) return [];
    const reviewedCountries = reviewedTargets
      .filter((target) => target.effect === effect)
      .map((target) => target.country);
    const targets = reviewedCountries.length
      ? reviewedCountries
      : tags;
    return uniqueSorted(targets.map((tag) => String(tag || "").toUpperCase()))
      .filter(Boolean)
      .map((country) => ({ country, effect, ...replacement }));
  });
}

function extractEffects(raw) {
  return [
    ...extractCultureMatches(raw, DIRECT_EFFECT, "add_primary_culture"),
    ...extractCultureMatches(raw, DANUBIAN_FEDERATION_EFFECT, "scripted_effect"),
  ].sort((left, right) => left.kind.localeCompare(right.kind) || left.culture.localeCompare(right.culture));
}

function executableRaw(raw) {
  return stripNamedBlocks(raw, "show_as_tooltip");
}

function stripNamedBlocks(raw, blockName) {
  const start = new RegExp(`\\b${blockName}\\s*=\\s*\\{`, "gi");
  let result = "";
  let cursor = 0;
  for (const match of raw.matchAll(start)) {
    result += raw.slice(cursor, match.index);
    let depth = 1;
    let index = match.index + match[0].length;
    while (index < raw.length && depth > 0) {
      if (raw[index] === "{") depth += 1;
      if (raw[index] === "}") depth -= 1;
      index += 1;
    }
    cursor = index;
  }
  return result + raw.slice(cursor);
}

function extractReplacements(raw) {
  return collectBlockReplacements(raw).flatMap((block) => {
    const directEffects = stripNestedBlocks(block);
    const added = extractCultureMatches(directEffects, DIRECT_EFFECT, "add_primary_culture");
    const removed = extractCultureMatches(directEffects, REMOVE_EFFECT, "remove_primary_culture").map((effect) => effect.culture);
    return added.flatMap((effect) => removed.map((removedCulture) => ({
      added_culture: effect.culture,
      removed_culture: removedCulture,
    })));
  });
}

function collectBlockReplacements(raw) {
  const blocks = [];
  const stack = [];
  for (let index = 0; index < raw.length; index += 1) {
    const character = raw[index];
    if (character === "{") {
      stack.push(index);
      continue;
    }
    if (character !== "}" || !stack.length) continue;
    const start = stack.pop();
    const block = raw.slice(start + 1, index);
    if (/\badd_primary_culture\s*=/.test(block) && /\bremove_primary_culture\s*=/.test(block)) blocks.push(block);
  }
  return blocks;
}

function stripNestedBlocks(raw) {
  let depth = 0;
  let result = "";
  for (const character of raw) {
    if (character === "{") {
      depth += 1;
      result += " ";
    } else if (character === "}") {
      depth = Math.max(0, depth - 1);
      result += " ";
    } else {
      result += depth === 0 ? character : " ";
    }
  }
  return result;
}

function extractCultureMatches(raw, expression, kind) {
  expression.lastIndex = 0;
  return [...raw.matchAll(expression)].map((match) => ({ culture: match[1], kind }));
}

function buildCountryRecord(tag, rawPaths, rawReplacements, startingCultures, optionGroups) {
  const paths = uniquePaths(rawPaths).sort(comparePath);
  const startingSet = new Set(startingCultures);
  const addedCultures = uniqueSorted(paths.map((item) => item.culture).filter((culture) => !startingSet.has(culture)));
  const maximumSets = maximumCultureSets(startingCultures, addedCultures, optionGroups);
  return {
    starting_primary_cultures: uniqueSorted(startingCultures),
    added_primary_cultures: addedCultures,
    maximum_primary_cultures: maximumSets.length === 1 ? maximumSets[0] : null,
    maximum_primary_culture_sets: maximumSets,
    paths,
    primary_culture_replacements: uniqueReplacements(rawReplacements).sort(compareReplacement),
    primary_culture_option_groups: optionGroups.map(({ source_contents, ...group }) => group),
  };
}

function maximumCultureSets(startingCultures, addedCultures, optionGroups) {
  const groupCultures = new Set(optionGroups.flatMap((group) => group.options.flatMap((option) => option.added_primary_cultures)));
  let sets = [uniqueSorted([...startingCultures, ...addedCultures.filter((culture) => !groupCultures.has(culture))])];
  for (const group of optionGroups) {
    sets = sets.flatMap((cultures) => group.options.map((option) => uniqueSorted([...cultures, ...option.added_primary_cultures])));
  }
  return uniqueSorted(sets.map((cultures) => cultures.join("|"))).map((signature) => signature ? signature.split("|") : []);
}

function optionGroupsFor(tag, paths) {
  const pathContents = new Set(paths.map((item) => `${item.content_type}:${item.content_id}`));
  return (PRIMARY_CULTURE_OPTION_GROUPS[tag] || []).filter((group) => group.source_contents.every((content) => pathContents.has(content)));
}

function conditionalFor(scopeKey, culture) {
  return CONDITIONAL_EFFECTS.find((item) => item.scope_key === scopeKey && item.added_culture === culture) || null;
}

function recordConditional(conditional, source) {
  const record = makeConditionalRecord(conditional, source);
  const signature = JSON.stringify(record);
  if (!conditionalEffects.some((item) => JSON.stringify(item) === signature)) conditionalEffects.push(record);
}

function makeReviewedPath(scripted) {
  return {
    culture: scripted.culture,
    content_type: scripted.effect_kind === "on_action" ? "on_action" : "scripted",
    content_id: scripted.content_id,
    effect_kind: scripted.effect_kind,
    source_file: scripted.source_file,
    source_line: scripted.source_line,
  };
}

function makeConditionalRecord(conditional, source) {
  return {
    added_culture: conditional.added_culture,
    ...(conditional.removed_culture ? { removed_culture: conditional.removed_culture } : {}),
    ...(conditional.country_tags ? { country_tags: uniqueSorted(conditional.country_tags) } : {}),
    eligible_when: conditional.eligible_when,
    content_type: source.content_type || "on_action",
    content_id: source.content_id,
    source_file: source.source_file,
    source_line: source.source_line,
  };
}

function addPath(pathsByCountry, tag, pathRecord) {
  const paths = pathsByCountry.get(tag) || [];
  paths.push(pathRecord);
  pathsByCountry.set(tag, paths);
}

function addReplacement(replacementsByCountry, tag, replacement) {
  const replacements = replacementsByCountry.get(tag) || [];
  replacements.push(replacement);
  replacementsByCountry.set(tag, replacements);
}

function makePathRecord(contentType, contentId, row, effect) {
  return {
    culture: effect.culture,
    content_type: contentType,
    content_id: contentId,
    effect_kind: effect.kind,
    source_file: String(row?.source_file || ""),
    source_line: Number(row?.source_line || 0),
  };
}

function makeReplacementRecord(contentType, contentId, row, replacement) {
  return {
    added_culture: replacement.added_culture,
    removed_culture: replacement.removed_culture,
    content_type: contentType,
    content_id: contentId,
    source_file: String(row?.source_file || ""),
    source_line: Number(row?.source_line || 0),
  };
}

function effectSignature(effect) {
  return `${effect.kind}|${effect.culture}`;
}

function replacementSignature(country, effect) {
  return `${String(country || "").toUpperCase()}|${effectSignature(effect)}`;
}

function uniquePaths(paths) {
  const bySignature = new Map();
  for (const item of paths) {
    const signature = [item.culture, item.content_type, item.content_id, item.effect_kind, item.source_file, item.source_line].join("|");
    if (!bySignature.has(signature)) bySignature.set(signature, item);
  }
  return [...bySignature.values()];
}

function uniqueReplacements(replacements) {
  const bySignature = new Map();
  for (const item of replacements) {
    const signature = [item.added_culture, item.removed_culture, item.content_type, item.content_id, item.source_file, item.source_line].join("|");
    if (!bySignature.has(signature)) bySignature.set(signature, item);
  }
  return [...bySignature.values()];
}

function makeUnresolvedEffect(contentType, contentId, row, effects) {
  return {
    content_type: contentType,
    content_id: contentId,
    cultures: uniqueSorted(effects.map((effect) => effect.culture)),
    effect_kinds: uniqueSorted(effects.map((effect) => effect.kind)),
    source_file: String(row?.source_file || ""),
    source_line: Number(row?.source_line || 0),
  };
}

function comparePath(left, right) {
  return left.culture.localeCompare(right.culture)
    || left.content_type.localeCompare(right.content_type)
    || left.content_id.localeCompare(right.content_id)
    || left.effect_kind.localeCompare(right.effect_kind)
    || left.source_file.localeCompare(right.source_file)
    || left.source_line - right.source_line;
}

function compareReplacement(left, right) {
  return left.added_culture.localeCompare(right.added_culture)
    || left.removed_culture.localeCompare(right.removed_culture)
    || left.content_type.localeCompare(right.content_type)
    || left.content_id.localeCompare(right.content_id)
    || left.source_file.localeCompare(right.source_file)
    || left.source_line - right.source_line;
}

function compareUnresolvedEffect(left, right) {
  return left.content_type.localeCompare(right.content_type)
    || left.content_id.localeCompare(right.content_id)
    || left.source_file.localeCompare(right.source_file)
    || left.source_line - right.source_line;
}

function compareConditionalEffect(left, right) {
  return left.content_type.localeCompare(right.content_type)
    || left.content_id.localeCompare(right.content_id)
    || left.source_file.localeCompare(right.source_file)
    || left.source_line - right.source_line;
}

function readDatabaseCollection(indexData, databaseDir, key) {
  const filename = indexData?.files?.[key];
  if (!filename) throw new Error(`Database index does not define files.${key}`);
  return readJson(path.join(databaseDir, filename));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function parseArgs(values) {
  const parsed = { database: "", help: false };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--database") {
      parsed.database = values[index + 1] || "";
      if (!parsed.database) throw new Error("Missing value for --database");
      index += 1;
    } else if (value === "--help" || value === "-h") {
      parsed.help = true;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return parsed;
}
