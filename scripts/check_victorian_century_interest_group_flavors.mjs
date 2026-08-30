import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseRoot = path.resolve(process.env.VICTORIAN_CENTURY_DATABASE_ROOT || path.join(root, "database", "victorian_century"));
const groups = readJson(path.join(databaseRoot, "interest_groups.json"));
const countries = readJson(path.join(databaseRoot, "countries.json"));
const boardSource = fs.readFileSync(path.join(root, "site", "app", "boards.js"), "utf8");
const zhUi = fs.readFileSync(path.join(root, "site", "locales", "ui.zh-Hans.js"), "utf8");
const enUi = fs.readFileSync(path.join(root, "site", "locales", "ui.en.js"), "utf8");

const armedForces = groups.find((group) => group.key === "ig_armed_forces");
const landowners = groups.find((group) => group.key === "ig_landowners");
const devout = groups.find((group) => group.key === "ig_devout");
const industrialists = groups.find((group) => group.key === "ig_industrialists");
const pettyBourgeoisie = groups.find((group) => group.key === "ig_petty_bourgeoisie");
assert.ok(armedForces, "VC data must include the Armed Forces");
assert.ok(landowners, "VC data must include the Landowners");
assert.ok(devout, "VC data must include the Devout");
assert.ok(industrialists, "VC data must include the Industrialists");
const turkeyDevout = countries.find((country) => country.tag === "TUR")?.interest_groups?.find((group) => group.key === "ig_devout");
assert.deepEqual(
  turkeyDevout?.display_name?.key,
  "ig_sunni_madrasahs",
  "Turkey must retain the Sunni Ulema flavor name",
);
assert.deepEqual(
  turkeyDevout?.active_traits?.map((trait) => trait.key),
  ["ig_trait_jihad", "ig_trait_words_remain", "ig_trait_faith_in_chains"],
  "Turkey must retain its distinct Sunni Ulema trait chain",
);
assert.ok(
  armedForces.potential_flavors?.some((flavor) => flavor.key === "ig_red_army"),
  "VC data must retain the Red Army scripted rename",
);
assert.ok(
  armedForces.potential_flavors?.some((flavor) => flavor.key === "ig_samurai"),
  "VC data must retain the Samurai later rename from the interest-group definition",
);
assert.ok(
  landowners.potential_flavors?.some((flavor) => flavor.key === "austrian_aristocracy"),
  "VC data must retain the Austrian Aristocracy history rename",
);
assert.ok(
  landowners.potential_flavors?.some((flavor) => flavor.key === "ig_kazoku"),
  "VC data must retain the Kazoku journal-entry rename",
);
assert.deepEqual(
  devout.potential_flavors?.find((flavor) => flavor.key === "ig_taiping_god_worshippers")?.traits?.map((trait) => trait.key),
  ["ig_trait_pious_fiction", "ig_trait_divine_right", "ig_trait_work_ethic"],
  "Taiping God Worshippers must use the Protestant-series traits",
);
assert.deepEqual(
  industrialists.potential_flavors?.find((flavor) => flavor.key === "ig_gosho")?.traits?.map((trait) => trait.key),
  ["ig_trait_zaibatsu_withdrawal", "ig_trait_railway_bonds", "ig_trait_zaibatsu_cooperation"],
  "Japanese industrialist later traits must be present",
);
assert.deepEqual(
  pettyBourgeoisie.potential_flavors?.find((flavor) => flavor.key === "ig_chonin")?.traits?.map((trait) => trait.key),
  ["ig_trait_xenophobia", "ig_trait_middle_managers", "ig_trait_treasury_bonds"],
  "Japanese petty-bourgeois later traits must be present",
);
assert.deepEqual(
  landowners.potential_flavors?.find((flavor) => flavor.key === "ig_kazoku")?.traits?.map((trait) => trait.key),
  ["ig_trait_kazoku_system", "ig_trait_taisei_hokan"],
  "Japanese Kazoku later traits must be present",
);
assert.match(boardSource, /function interestGroupIsScriptedRename\(/, "VC needs a scripted-rename classifier");
assert.match(boardSource, /return "scripted"/, "VC scripted renames need their own category");
assert.match(boardSource, /function interestGroupUsesScriptedRenameCategory\(/, "the scripted-rename category must be VC-specific");
assert.match(
  boardSource,
  /if \(flavor\.category === "scripted"\) return t\("interestGroup\.scriptedVariants"\);/,
  "VC scripted renames need an explicit source label in the detail header",
);
assert.match(zhUi, /"interestGroup\.scriptedVariants": "事件与决议改名"/, "VC needs a Chinese scripted-rename label");
assert.match(enUi, /"interestGroup\.scriptedVariants": "Event and decision renames"/, "VC needs an English scripted-rename label");

const intelligentsia = groups.find((group) => group.key === "ig_intelligentsia");
assert.ok(intelligentsia?.condition_variants?.some((variant) => variant.key === "constitutionalists"), "VC needs the constitutionalist intelligentsia condition");
assert.ok(pettyBourgeoisie?.condition_variants?.some((variant) => variant.key === "mercantile"), "VC needs the mercantile petty-bourgeoisie condition");
assert.match(boardSource, /const interestGroupCountryVariantDefinition/, "country-trait combinations need descriptive-name definitions");
assert.match(boardSource, /interestGroup\.variant\.intelligentsia\.germanConstitutionalists/, "the German constitutionalists need an explicit combined name");
assert.match(boardSource, /interestGroup\.variant\.pettyBourgeoisie\.southAsian/, "South Asian petty bourgeoisie need an explicit descriptive name");
assert.match(boardSource, /function interestGroupCountryVariantKey\(/, "country-trait definitions must be resolved from group, traits, and ideologies");
assert.match(boardSource, /variant\.countries\.length === 1/, "single-country trait variants need dedicated display names");
assert.match(zhUi, /interestGroup\.singleCountryTraitVariant/, "the Chinese single-country trait variant template is missing");
assert.match(enUi, /interestGroup\.singleCountryTraitVariant/, "the English single-country trait variant template is missing");
assert.match(boardSource, /conditionVariant:\s*"constitutionalists"/, "the broad constitutionalist country group must merge into the constitutionalist condition variant");
assert.match(zhUi, /"interestGroup\.variant\.intelligentsia\.germanConstitutionalists": "知识分子（德意志／立宪派）"/, "the Chinese German constitutionalist label is missing");
assert.match(enUi, /"interestGroup\.variant\.intelligentsia\.germanConstitutionalists": "Intelligentsia \(German \/ Constitutionalists\)"/, "the English German constitutionalist label is missing");
assert.match(zhUi, /"interestGroup\.variant\.pettyBourgeoisie\.southAsian": "小市民（南亚）"/, "the Chinese South Asian petty-bourgeoisie label is missing");
assert.match(enUi, /"interestGroup\.variant\.pettyBourgeoisie\.southAsian": "Petite Bourgeoisie \(South Asian\)"/, "the English South Asian petty-bourgeoisie label is missing");
for (const label of [
  "interestGroup.variant.armedForces.latinSpanish",
  "interestGroup.variant.industrialists.china",
  "interestGroup.variant.landowners.hanCulture",
  "interestGroup.variant.ruralFolk.lowCountries",
  "interestGroup.variant.tradeUnions.german",
]) {
  assert.match(zhUi, new RegExp(`"${label}":`), `the Chinese variant label ${label} is missing`);
  assert.match(enUi, new RegExp(`"${label}":`), `the English variant label ${label} is missing`);
}

const constitutionalist = countries.find((country) => country.tag === "ALW")?.interest_groups?.find((group) => group.key === "ig_intelligentsia");
const germanConstitutionalist = countries.find((country) => country.tag === "BAV")?.interest_groups?.find((group) => group.key === "ig_intelligentsia");
const southAsianPettyBourgeoisie = countries.find((country) => country.tag === "ALW")?.interest_groups?.find((group) => group.key === "ig_petty_bourgeoisie");
assert.ok(constitutionalist?.active_ideologies?.some((ideology) => ideology.key === "ideology_constitutionalist"), "ALW must demonstrate the constitutionalist rule");
assert.ok(germanConstitutionalist?.active_traits?.some((trait) => trait.key === "ig_trait_leopoldina"), "BAV must retain the German intelligentsia traits");
assert.ok(germanConstitutionalist?.active_ideologies?.some((ideology) => ideology.key === "ideology_constitutionalist"), "BAV must demonstrate the combined German and constitutionalist rules");
assert.ok(southAsianPettyBourgeoisie?.active_ideologies?.some((ideology) => ideology.key === "ideology_modernizer"), "ALW petty bourgeoisie must demonstrate the South Asian ideology rule");

console.log(JSON.stringify({
  victorian_century_interest_group_flavors: "ok",
  groups: groups.length,
  armed_forces_flavors: armedForces.potential_flavors.length,
  landowners_flavors: landowners.potential_flavors.length,
}, null, 2));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}
