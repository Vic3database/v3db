import assert from "node:assert/strict";
import { searchAliasFields } from "./search_aliases.mjs";

const messagesByLocale = {
  "zh-Hans": {
    qing: "大清",
    china: "中国",
    germanAlsace: "埃尔萨斯‑洛林根",
    alsace: "阿尔萨斯‑洛林",
    consortium: "财团",
    company: "公司",
  },
  en: {
    qing: "Dai Ching",
    china: "China",
    germanAlsace: "Elsaß-Lothringen",
    alsace: "Alsace-Lorraine",
    consortium: "Consortium",
    company: "Company",
  },
};

assert.deepEqual(searchAliasFields("country", {
  dynamicNameVariants: [{ loc: { name: "qing" } }, { loc: { name: "china" } }],
}, messagesByLocale, { "zh-Hans": "中国", en: "China" }), {
  aliases: { "zh-Hans": ["大清"], en: ["Dai Ching"] },
});

assert.deepEqual(searchAliasFields("region", {
  dynamic_name_variants: [{ loc: { name: "germanAlsace" } }],
}, messagesByLocale, { "zh-Hans": "阿尔萨斯‑洛林", en: "Alsace-Lorraine" }), {
  aliases: { "zh-Hans": ["埃尔萨斯‑洛林根"], en: ["Elsaß-Lothringen"] },
});

assert.deepEqual(searchAliasFields("company", {
  dynamic_company_type_names: [
    { loc: { name: "company" } },
    { loc: { name: "consortium" } },
    { loc: { name: "consortium" } },
  ],
}, messagesByLocale, { "zh-Hans": "优质谷物公司", en: "Quality Grains Inc." }), {
  aliases: { "zh-Hans": ["公司", "财团"], en: ["Company", "Consortium"] },
});

assert.deepEqual(searchAliasFields("building", {
  aliases: ["building_barracks", "building_barracks", ""],
}, messagesByLocale, { "zh-Hans": "兵营", en: "Barracks" }), {
  internalAliases: ["building_barracks"],
});

assert.deepEqual(searchAliasFields("culture", {}, messagesByLocale, {
  "zh-Hans": "汉文化",
  en: "Han",
}), {});

console.log(JSON.stringify({ search_alias_unit: "ok" }));
