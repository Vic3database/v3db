import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { readChunkedSiteData, readSiteSearchIndex } from "./site_data_reader.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vanilla = readChunkedSiteData(root, "site/versions/1.13.11");
const vc = readStandaloneSiteData(path.join(root, "site", "vc"));

auditDataset("vanilla", vanilla, {
  forbiddenTraitKeys: ["ig_trait_railway_bonds", "ig_trait_kazoku_system", "ig_trait_taisei_hokan"],
});
auditDataset("vc", vc, {
  requiredTraitKeys: ["ig_trait_railway_bonds", "ig_trait_kazoku_system", "ig_trait_taisei_hokan"],
});

const vanillaJapan = countryInterestGroup(vanilla, "JAP", "ig_industrialists");
assert.deepEqual(
  Array.from(vanillaJapan?.active_traits || [], (trait) => trait.key),
  ["ig_trait_zaibatsu_withdrawal", "ig_trait_engines_of_progress", "ig_trait_zaibatsu_cooperation"],
  "vanilla Japan industrialists must retain the vanilla Gosho trait chain",
);
const vcJapan = countryInterestGroup(vc, "JAP", "ig_industrialists");
assert.deepEqual(
  Array.from(vcJapan?.active_traits || [], (trait) => trait.key),
  ["ig_trait_zaibatsu_withdrawal", "ig_trait_railway_bonds", "ig_trait_zaibatsu_cooperation"],
  "VC Japan industrialists must retain the Railway Bonds trait chain",
);

for (const [label, data] of [["vanilla", vanilla], ["vc", vc]]) {
  const traitMap = new Map(data.interestGroupTraits.map((trait) => [trait.key, trait]));
  for (const country of data.countries || []) {
    for (const group of country.interestGroups || []) {
      for (const trait of [...(group.base_traits || []), ...(group.active_traits || [])]) {
        const sourceTrait = traitMap.get(trait.key);
        assert.equal(
          JSON.stringify(comparableTrait(trait)),
          JSON.stringify(comparableTrait(sourceTrait)),
          `${label} ${country.tag}/${group.key} trait ${trait.key} must match the unified trait record`,
        );
      }
    }
  }
}

console.log(JSON.stringify({
  interest_group_trait_coverage: "ok",
  vanilla_traits: vanilla.interestGroupTraits.length,
  vc_traits: vc.interestGroupTraits.length,
}, null, 2));

function auditDataset(label, data, { forbiddenTraitKeys = [], requiredTraitKeys = [] }) {
  const traits = data.interestGroupTraits || [];
  const traitMap = new Map(traits.map((trait) => [trait.key, trait]));
  assert.equal(new Set(traits.map((trait) => trait.key)).size, traits.length, `${label} trait keys must be unique`);
  for (const trait of traits) {
    assert.ok(trait.id === `interest_group_trait:${trait.key}`, `${label} trait ${trait.key} has an inconsistent id`);
    assert.ok(typeof trait.icon === "string", `${label} trait ${trait.key} has no icon field`);
    assert.ok(typeof trait.min_approval === "string" && typeof trait.max_approval === "string", `${label} trait ${trait.key} has incomplete approval fields`);
    assert.ok(Array.isArray(trait.modifiers), `${label} trait ${trait.key} has no modifier list`);
    for (const modifier of trait.modifiers) {
      assert.ok(typeof modifier.key === "string" && modifier.key, `${label} trait ${trait.key} has a modifier without a key`);
      assert.ok(typeof modifier.value_raw === "string", `${label} trait ${trait.key} has a modifier without its source value`);
    }
  }
  assert.ok(traits.every((trait) => trait.loc?.name), `${label} traits must have localization name references`);
  assert.ok(traits.every((trait) => trait.loc?.description), `${label} traits must have localization description references`);
  assert.ok(traits.every((trait) => trait.loc?.modifierSummary), `${label} traits must have localization summary references`);
  for (const key of requiredTraitKeys) assert.ok(traitMap.has(key), `${label} is missing required trait ${key}`);

  const references = new Set();
  for (const group of data.interestGroups || []) {
    collectTraitKeys(group.base_traits, references);
    for (const variant of group.condition_variants || []) collectTraitKeys(variant.traits, references);
    for (const flavor of group.potential_flavors || []) collectTraitKeys(flavor.traits, references);
  }
  for (const country of data.countries || []) {
    for (const group of country.interestGroups || []) {
      collectTraitKeys(group.base_traits, references);
      collectTraitKeys(group.active_traits, references);
      for (const variant of group.condition_variants || []) collectTraitKeys(variant.traits, references);
    }
  }

  assert.deepEqual(
    [...references].filter((key) => !traitMap.has(key)).sort(),
    [],
    `${label} has trait references absent from its unified trait table`,
  );
  assert.deepEqual(
    forbiddenTraitKeys.filter((key) => references.has(key)),
    [],
    `${label} must not reference Victorian Century-only traits`,
  );

  const searchFile = label === "vanilla"
    ? path.join(root, "site", "versions", "1.13.11", "search-index.js")
    : path.join(root, "site", "vc", "search-index.js");
  const search = readSiteSearchIndex(searchFile);
  const searchTraitKeys = new Set((search.entries || [])
    .filter((entry) => entry.kind === "interestGroupTrait")
    .map((entry) => entry.key));
  assert.deepEqual(
    [...traitMap.keys()].filter((key) => !searchTraitKeys.has(key)),
    [],
    `${label} search index must contain every unified interest-group trait`,
  );

  const localeFiles = label === "vanilla"
    ? ["locale-ideologies.en.js", "locale-ideologies.zh-Hans.js"].map((file) => path.join(root, "site", "versions", "1.13.11", file))
    : ["locale-ideologies.en.js", "locale-ideologies.zh-Hans.js"].map((file) => path.join(root, "site", "vc", file));
  for (const file of localeFiles) {
    const messages = readLocaleMessages(file);
    for (const trait of traits) {
      for (const field of ["name", "description", "modifierSummary"]) {
        const key = trait.loc[field];
        assert.ok(Object.hasOwn(messages, key), `${label} locale is missing ${key}`);
        assert.notEqual(messages[key], "", `${label} locale has an empty value for ${key}`);
      }
    }
  }
}

function collectTraitKeys(items, target) {
  for (const item of items || []) if (item?.key) target.add(item.key);
}

function comparableTrait(trait) {
  return {
    id: trait?.id,
    key: trait?.key,
    icon: trait?.icon,
    min_approval: trait?.min_approval,
    max_approval: trait?.max_approval,
    modifiers: (trait?.modifiers || []).map((modifier) => ({
      key: modifier.key,
      value: modifier.value,
      value_raw: modifier.value_raw,
      category: modifier.category?.key,
    })),
    loc: trait?.loc,
  };
}

function countryInterestGroup(data, countryKey, groupKey) {
  return data.countries?.find((country) => country.tag === countryKey)?.interestGroups
    ?.find((group) => group.key === groupKey);
}

function readStandaloneSiteData(dir) {
  const index = readGlobal(path.join(dir, "data-index.js"), "VIC3_DATA_INDEX");
  const data = {};
  for (const chunk of Object.values(index.chunks || {})) {
    for (const file of chunk.files || []) {
      const value = readGlobal(path.join(dir, file), "VIC3_DATA_CHUNK");
      for (const [field, rows] of Object.entries(value || {})) {
        data[field] = field === "countries" ? [...(data[field] || []), ...(rows || [])] : rows;
      }
    }
  }
  return data;
}

function readGlobal(file, globalName) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  return context.window[globalName] || {};
}

function readLocaleMessages(file) {
  const context = { window: { VIC3_LOCALE_CHUNKS: {} } };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  return Object.values(context.window.VIC3_LOCALE_CHUNKS)[0]?.messages || {};
}
