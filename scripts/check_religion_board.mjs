import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { readChunkedSiteData, readSiteLocaleChunk } from "./site_data_reader.mjs";
import { readSiteAppSource } from "./site_frontend_sources.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appSource = readSiteAppSource(root);
const extractorSource = fs.readFileSync(path.join(root, "scripts", "extract_vic3_countries.mjs"), "utf8");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const readLocaleMessages = (file) => {
  const context = { window: { VIC3_LOCALE_CHUNKS: {} } };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  return Object.values(context.window.VIC3_LOCALE_CHUNKS)[0]?.messages || {};
};
const readDataChunk = (file) => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  return context.window.VIC3_DATA_CHUNK || {};
};
const vanillaIndex = readJson(path.join(root, "database", "vic3_1.13.11", "index.json"));
const vanillaReligions = readJson(path.join(root, "database", "vic3_1.13.11", "religions.json"));
const vcReligions = readJson(path.join(root, "database", "victorian_century", "religions.json"));
assert.equal(vanillaIndex.mod_path, "", "the 1.13.11 database must not declare a mod path");
const vanillaSunni = vanillaReligions.find((item) => item.key === "sunni");
const vanillaTurkey = vanillaSunni?.devout_flavors?.find((flavor) => flavor.country_tags?.includes("TUR"));
assert.deepEqual(
  Array.from(vanillaTurkey?.traits || []).sort(),
  ["ig_trait_da_wat", "ig_trait_mecelle", "ig_trait_pious_fiction"],
  "vanilla Turkey Sunni devout flavor must use vanilla traits",
);
assert.ok(
  !(vanillaSunni?.devout_flavors || []).some((flavor) => String(flavor.source_file || "").includes("3219394272")),
  "vanilla Sunni data must not contain Victorian Century source paths",
);
assert.match(extractorSource, /const isTurkey = modContentRoot && key === "ig_sunni_madrasahs"/, "Turkey Sunni flavor split must be limited to mod extraction");
assert.match(extractorSource, /if \(modContentRoot && religion\.key === "sunni"\)/, "Turkey Sunni religion row must be limited to mod extraction");
const vcSunni = vcReligions.find((item) => item.key === "sunni");
const vcTurkey = vcSunni?.devout_flavors?.find((flavor) => flavor.key === "ig_sunni_madrasahs_turkey");
assert.deepEqual(
  Array.from(vcTurkey?.traits || []),
  ["ig_trait_jihad", "ig_trait_words_remain", "ig_trait_faith_in_chains"],
  "Victorian Century Turkey Sunni flavor must retain the mod-defined traits",
);
assert.ok(String(vcTurkey?.source_file || "").includes("3219394272"), "Victorian Century Turkey Sunni flavor must retain its mod source path");
const vcReligionLocaleEn = readLocaleMessages(path.join(root, "site", "vc", "locale-religions.en.js"));
assert.equal(
  vcReligionLocaleEn["religion:sunni:ig_sunni_madrasahs_turkey.name"],
  "Sunni Ulema (Turkey)",
  "Victorian Century Turkey Sunni flavor must have an English localized name",
);
assert.equal(readDataChunk(path.join(root, "site", "vc", "data-religions.js")).religions?.length, 17, "VC site religion data must contain all religions");
for (const [label, dir] of [
  ["VC site", path.join(root, "site", "vc")],
  ["VC standalone", path.join(root, "Victorian Century Database")],
]) {
  for (const file of ["data-religions.js", "locale-religions.en.js", "locale-religions.zh-Hans.js"]) {
    assert.ok(fs.existsSync(path.join(dir, file)), `${label} must include ${file}`);
  }
}
for (const [religionKey, countryTag, traitKeys] of [
  ["jewish", "ISR", ["ig_trait_traditsye", "ig_trait_yeshivot", "ig_trait_the_best_revenge"]],
  ["animist", "", ["ig_trait_pious_fiction", "ig_trait_divine_right", "ig_trait_be_fruitful_and_multiply"]],
]) {
  const row = vanillaReligions.find((item) => item.key === religionKey);
  const flavor = countryTag
    ? row?.devout_flavors?.find((item) => item.country_tags?.includes(countryTag))
    : row?.devout_flavors?.find((item) => item.key === religionKey);
  assert.ok(flavor, `${religionKey} must expose its condition flavor`);
  assert.deepEqual([...flavor.traits].sort(), [...traitKeys].sort(), `${religionKey} condition flavor must retain source traits`);
}
assert.match(appSource, /translateMessage\(flavor\.loc\?\.name, flavor\.key\)/, "religion flavor names must localize generated variant keys");
const religionChunkPath = path.join(root, "site", "versions", "1.13.11", "data-religions.js");
const religionContext = { window: {} };
vm.runInNewContext(fs.readFileSync(religionChunkPath, "utf8"), religionContext, { filename: religionChunkPath });
const sunni = religionContext.window.VIC3_DATA_CHUNK?.religions?.find((item) => item.key === "sunni");
assert.ok(sunni, "1.13.11 religion data must contain Sunni Islam");
const turkey = sunni.devout_flavors?.find((flavor) => flavor.country_tags?.includes("TUR"));
assert.deepEqual(Array.from(turkey?.country_tags || []), ["TUR"], "Turkey Sunni flavor must be scoped to TUR");
assert.deepEqual(Array.from(turkey?.traits || []).sort(), ["ig_trait_da_wat", "ig_trait_mecelle", "ig_trait_pious_fiction"], "the vanilla site chunk must retain vanilla Turkey traits");
const searchIndexPath = path.join(root, "site", "versions", "1.13.11", "search-index.js");
const searchContext = { window: {} };
vm.runInNewContext(fs.readFileSync(searchIndexPath, "utf8"), searchContext, { filename: searchIndexPath });
const religionSearchEntries = searchContext.window.VIC3_SEARCH_INDEX?.entries?.filter((item) => item.kind === "religion") || [];
assert.equal(religionSearchEntries.length, 17, "the global search index must contain every religion");
for (const [label, dir] of [["vanilla", path.join(root, "site", "versions", "1.13.11")], ["vc", path.join(root, "site", "vc")]]) {
  for (const file of ["data-religions.js", "locale-religions.en.js", "locale-religions.zh-Hans.js"]) {
    assert.ok(fs.existsSync(path.join(dir, file)), `${label} religion output must include ${file}`);
  }
}

const goodsChunkPath = path.join(root, "site", "versions", "1.13.11", "data-goods.js");
const goodsContext = { window: {} };
vm.runInNewContext(fs.readFileSync(goodsChunkPath, "utf8"), goodsContext, { filename: goodsChunkPath });
const goods = goodsContext.window.VIC3_DATA_CHUNK?.goods || [];
assert.deepEqual(
  ["liquor", "wine"].map((key) => goods.find((item) => item.key === key)?.loc?.name),
  ["item:0:liquor.name", "item:0:wine.name"],
  "Sunni taboo goods must have localization keys",
);
const zhLocale = readSiteLocaleChunk(path.join(root, "site", "versions", "1.13.11", "locale-goods.zh-Hans.js"), "zh-Hans:goods:locale-goods");
assert.equal(zhLocale?.messages?.["item:0:liquor.name"], "烈酒", "liquor must resolve to its Chinese label");
assert.equal(zhLocale?.messages?.["item:0:wine.name"], "葡萄酒", "wine must resolve to its Chinese label");
assert.match(appSource, /selected\.taboos[^\n]*economyDisplayName\(good\)/, "religion taboo rendering must use localized good names");
assert.doesNotMatch(appSource, /selected\.taboos[^\n]*goodByKey\.get\(key\)\?\.name_zh/, "religion taboo rendering must not rely on absent name_zh fields");
assert.match(appSource, /data-concept-description=\"\$\{escapeHtml\(description\)\}\"/, "religion traits must pass localized descriptions to the shared tooltip");
assert.match(appSource, /data-concept-secondary-description=\"\$\{escapeHtml\(modifierSummary\)\}\"/, "religion traits must pass modifier summaries to the shared tooltip");
assert.match(appSource, /tabindex=\"0\" data-concept-kind=\"interestGroupTrait\"/, "religion traits must be keyboard-focusable tooltip targets");

console.log(JSON.stringify({ religion_board: "ok", sunniTurkeyTraits: turkey.traits, tabooLabels: ["烈酒", "葡萄酒"] }, null, 2));
