import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readChunkedSiteData } from "./site_data_reader.mjs";
import { readSiteAppSource } from "./site_frontend_sources.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appSource = readSiteAppSource(root);
const zhUi = fs.readFileSync(path.join(root, "site", "locales", "ui.zh-Hans.js"), "utf8");
const enUi = fs.readFileSync(path.join(root, "site", "locales", "ui.en.js"), "utf8");
const siteData = readChunkedSiteData(root);

const expectedVariants = [
  ["ig_landowners:ig_trait_family_ties|ig_trait_noble_privileges|ig_trait_wiener_walzer:ideology_hierarchic|ideology_paternalistic|ideology_patriarchal", "interestGroup.variant.landowners.austria", "地主（奥地利）", "Landowners (Austria)"],
  ["ig_landowners:ig_trait_fazenda_ibicaba|ig_trait_latifundios|ig_trait_noble_privileges:ideology_hierarchic|ideology_paternalistic|ideology_patriarchal", "interestGroup.variant.landowners.brazil", "地主（巴西）", "Landowners (Brazil)"],
  ["ig_landowners:ig_trait_family_ties|ig_trait_noble_privileges|ig_trait_patrician_philanthropy:ideology_hierarchic|ideology_patriarchal|ideology_republican_paternalistic", "interestGroup.variant.landowners.california", "地主（加利福尼亚）", "Landowners (California)"],
  ["ig_landowners:ig_trait_family_ties|ig_trait_noble_privileges|ig_trait_noblesse_oblige:ideology_hierarchic|ideology_patriarchal|ideology_republican_paternalistic", "interestGroup.variant.landowners.latinAmericaBoer", "地主（拉丁美洲、布尔）", "Landowners (Latin America, Boer)"],
  ["ig_landowners:ig_trait_family_ties|ig_trait_junkerdom|ig_trait_noble_privileges:ideology_hierarchic|ideology_paternalistic|ideology_patriarchal", "interestGroup.variant.landowners.germanyNorthGermanFederation", "地主（德意志、北德意志邦联）", "Landowners (Germany, North German Federation)"],
  ["ig_landowners:ig_trait_family_ties|ig_trait_noble_privileges|ig_trait_noblesse_oblige:ideology_hierarchic|ideology_magnatial|ideology_patriarchal", "interestGroup.variant.landowners.polish", "地主（波兰）", "Landowners (Poland)"],
  ["ig_landowners:ig_trait_family_ties|ig_trait_noble_privileges|ig_trait_noblesse_oblige:ideology_carlist_ig|ideology_hierarchic|ideology_patriarchal", "interestGroup.variant.landowners.carlistSpain", "地主（卡洛斯派西班牙）", "Landowners (Carlist Spain)"],
  ["ig_trade_unions:ig_trait_bourse_du_travail|ig_trait_industrial_organizers|ig_trait_work_to_rule:ideology_anti_slavery|ideology_egalitarian|ideology_populist|ideology_proletarian", "interestGroup.variant.tradeUnions.france", "工会（法兰西）", "Trade Unions (France)"],
  ["ig_armed_forces:ig_trait_clube_militar|ig_trait_coronelismo|ig_trait_patriotic_fervor:ideology_jingoist|ideology_loyalist|ideology_patriotic", "interestGroup.variant.armedForces.brazil", "军队（巴西）", "Armed Forces (Brazil)"],
  ["ig_armed_forces:ig_trait_newly_created_army|ig_trait_parochial_leadership|ig_trait_self_strengthening:ideology_jingoist|ideology_loyalist|ideology_patriotic", "interestGroup.variant.armedForces.china", "军队（中国）", "Armed Forces (China)"],
  ["ig_armed_forces:ig_trait_el_buen_jefe|ig_trait_materiel_waste|ig_trait_veteran_consultation:ideology_jingoist|ideology_loyalist|ideology_patriotic", "interestGroup.variant.armedForces.spanishLatinAmerica", "军队（西语拉美）", "Armed Forces (Spanish Latin America)"],
  ["ig_devout:ig_trait_the_best_revenge|ig_trait_traditsye|ig_trait_yeshivot:ideology_moralist|ideology_patriarchal|ideology_pious", "interestGroup.variant.devout.judaism", "犹太教", "Judaism"],
  ["ig_industrialists:ig_trait_engines_of_progress|ig_trait_job_creators|ig_trait_tax_avoidance:ideology_colonialist|ideology_individualist|ideology_plutocratic", "interestGroup.variant.industrialists.colonialCompanies", "实业家（殖民公司）", "Industrialists (Colonial Companies)"],
  ["ig_industrialists:ig_trait_job_creators|ig_trait_tax_avoidance|ig_trait_the_goods_must_flow:ideology_individualist|ideology_laissez_faire|ideology_plutocratic", "interestGroup.variant.industrialists.brazil", "实业家（巴西）", "Industrialists (Brazil)"],
  ["ig_industrialists:ig_trait_engines_of_progress|ig_trait_tax_avoidance|ig_trait_ventilate_unify_beautify:ideology_individualist|ideology_laissez_faire|ideology_plutocratic", "interestGroup.variant.industrialists.france", "实业家（法兰西）", "Industrialists (France)"],
  ["ig_industrialists:ig_trait_engines_of_progress|ig_trait_kommerskollegium|ig_trait_tax_avoidance:ideology_individualist|ideology_laissez_faire|ideology_plutocratic", "interestGroup.variant.industrialists.sweden", "实业家（瑞典）", "Industrialists (Sweden)"],
  ["ig_rural_folk:ig_trait_nucleos_coloniais|ig_trait_old_ways|ig_trait_plantation_work:ideology_agrarian|ideology_isolationist|ideology_particularist", "interestGroup.variant.ruralFolk.brazil", "乡村民众（巴西）", "Rural Folk (Brazil)"],
  ["ig_rural_folk:ig_trait_honest_work|ig_trait_obshchina|ig_trait_old_ways:ideology_agrarian|ideology_isolationist|ideology_particularist", "interestGroup.variant.ruralFolk.russia", "乡村民众（俄罗斯）", "Rural Folk (Russia)"],
  ["ig_petty_bourgeoisie:ig_trait_effendi|ig_trait_treasury_bonds|ig_trait_xenophobia:ideology_meritocratic|ideology_patriotic|ideology_reactionary", "interestGroup.variant.pettyBourgeoisie.egypt", "小市民（埃及）", "Petite Bourgeoisie (Egypt)"],
  ["ig_petty_bourgeoisie:ig_trait_haute_finance|ig_trait_master_of_the_house|ig_trait_xenophobia:ideology_meritocratic|ideology_patriotic|ideology_reactionary", "interestGroup.variant.pettyBourgeoisie.france", "小市民（法兰西）", "Petite Bourgeoisie (France)"],
  ["ig_petty_bourgeoisie:ig_trait_bah_humbug|ig_trait_civil_service|ig_trait_old_lady_of_threadneedle_street:ideology_meritocratic|ideology_patriotic|ideology_reactionary", "interestGroup.variant.pettyBourgeoisie.greatBritain", "小市民（大不列颠）", "Petite Bourgeoisie (Great Britain)"],
  ["ig_petty_bourgeoisie:ig_trait_middle_managers|ig_trait_treasury_bonds|ig_trait_xenophobia:ideology_cartist|ideology_patriotic|ideology_reactionary", "interestGroup.variant.pettyBourgeoisie.portugal", "小市民（葡萄牙）", "Petite Bourgeoisie (Portugal)"],
  ["ig_petty_bourgeoisie:ig_trait_bergsbrukens_valdistrikten|ig_trait_treasury_bonds|ig_trait_xenophobia:ideology_meritocratic|ideology_patriotic|ideology_reactionary", "interestGroup.variant.pettyBourgeoisie.sweden", "小市民（瑞典）", "Petite Bourgeoisie (Sweden)"],
  ["ig_petty_bourgeoisie:ig_trait_effendi|ig_trait_reorganization|ig_trait_xenophobia:ideology_meritocratic|ideology_patriotic|ideology_reactionary", "interestGroup.variant.pettyBourgeoisie.turkey", "小市民（土耳其）", "Petite Bourgeoisie (Turkey)"],
  ["ig_intelligentsia:ig_trait_avant_garde|ig_trait_bachareis|ig_trait_brasilidade|ig_trait_propagandists|ig_trait_social_criticism:ideology_anti_clerical|ideology_anti_slavery|ideology_constitutionalist|ideology_liberal", "interestGroup.variant.intelligentsia.brazil", "知识分子（巴西）", "Intelligentsia (Brazil)"],
  ["ig_intelligentsia:ig_trait_avant_garde|ig_trait_les_beaux_arts|ig_trait_social_criticism:ideology_anti_clerical|ideology_anti_slavery|ideology_liberal|ideology_republican", "interestGroup.variant.intelligentsia.france", "知识分子（法兰西）", "Intelligentsia (France)"],
  ["ig_intelligentsia:ig_trait_avant_garde|ig_trait_propagandists|ig_trait_social_criticism:ideology_anti_slavery|ideology_liberal|ideology_republican", "interestGroup.variant.intelligentsia.rome", "知识分子（罗马）", "Intelligentsia (Rome)"],
  ["ig_intelligentsia:ig_trait_avant_garde|ig_trait_crisis_of_identity|ig_trait_propagandists:ideology_anti_clerical|ideology_anti_slavery|ideology_liberal|ideology_republican", "interestGroup.variant.intelligentsia.russiaTurkey", "知识分子（俄罗斯、土耳其）", "Intelligentsia (Russia, Turkey)"],
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function signature(items) {
  return (items || []).map((item) => item?.key || "").filter(Boolean).sort().join("|");
}

function definedCountryVariantKeys() {
  const start = appSource.indexOf("const interestGroupCountryVariantDefinition = {");
  const end = appSource.indexOf("\n};", start);
  assert.ok(start >= 0 && end > start, "country-variant definition table is missing");
  return new Set([...appSource.slice(start, end).matchAll(/^\s+"([^"]+)":\s*\{/gm)].map((match) => match[1]));
}

const definedKeys = definedCountryVariantKeys();
for (const [variantKey, messageKey, zhName, enName] of expectedVariants) {
  assert.match(
    appSource,
    new RegExp(`"${escapeRegExp(variantKey)}":\\s*\\{\\s*name:\\s*"${escapeRegExp(messageKey)}"`),
    `manual name mapping is missing for ${variantKey}`,
  );
  assert.match(zhUi, new RegExp(`"${escapeRegExp(messageKey)}": "${escapeRegExp(zhName)}"`), `Chinese name is missing for ${variantKey}`);
  assert.match(enUi, new RegExp(`"${escapeRegExp(messageKey)}": "${escapeRegExp(enName)}"`), `English name is missing for ${variantKey}`);
}

const automaticFallbacks = [];
for (const parent of siteData.interestGroups || []) {
  const baseKey = `${parent.key}:${signature(parent.base_traits)}:${signature(parent.ideologies)}`;
  for (const country of siteData.countries || []) {
    const group = (country.interestGroups || []).find((entry) => entry.key === parent.key);
    if (!group || group.display_name?.is_flavored) continue;
    const variantKey = `${parent.key}:${signature(group.active_traits)}:${signature(group.active_ideologies)}`;
    if (variantKey !== baseKey && !definedKeys.has(variantKey)) automaticFallbacks.push(variantKey);
  }
}
assert.deepEqual([...new Set(automaticFallbacks)].sort(), [], "every non-base unnamed country trait combination needs a manual name");

console.log("interest_group_variant_names: ok");
