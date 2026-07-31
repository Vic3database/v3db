import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "site", "app", "i18n.js"), "utf8");
const context = {
  window: {},
  URLSearchParams,
  Intl,
  console: { warn() {} },
  location: { search: "", href: "http://localhost/index.html", hash: "" },
  history: { replaceState() {} },
  localStorage: { getItem() { return null; }, setItem() {} },
  navigator: { languages: [] },
  document: { documentElement: { lang: "" }, head: { appendChild() {} }, createElement() { return {}; } },
  localeRuntime: { current: "en", messages: {}, englishMessages: {}, dataMessages: {}, loadedChunks: new Set(), collator: new Intl.Collator("en"), numberFormat: new Intl.NumberFormat("en"), pluralRules: new Intl.PluralRules("en") },
  els: {},
};
context.window.localeRuntime = context.localeRuntime;
context.window.VICDATA_LOCALE_CONFIG = { storageKey: "vicdata-language", supported: [
  { id: "zh-Hans", label: "简体中文", ui: "locales/ui.zh-Hans.js", collator: "zh-Hans-CN" },
  { id: "en", label: "English", ui: "locales/ui.en.js", collator: "en" },
], fallback: "en" };
vm.runInNewContext(source, context, { filename: "i18n.js" });

assert.equal(context.selectInitialLocale({ search: "?lang=en", stored: "zh-Hans", languages: ["zh-CN"] }), "en");
assert.equal(context.selectInitialLocale({ search: "?lang=zh-Hans", stored: "en", languages: ["en"] }), "zh-Hans");
assert.equal(context.selectInitialLocale({ search: "?lang=unknown", stored: "en", languages: ["zh-CN"] }), "en");
assert.equal(context.selectInitialLocale({ search: "", stored: "", languages: ["zh-CN"] }), "zh-Hans");
assert.equal(context.selectInitialLocale({ search: "", stored: "", languages: ["fr-FR"] }), "en");
context.localeRuntime.messages = { greeting: "Hello {name}" };
context.localeRuntime.englishMessages = { fallback: "Fallback" };
assert.equal(context.translateMessage("fallback", "key"), "Fallback");
assert.equal(context.translateMessage("missing", "key"), "key");
assert.equal(context.t("greeting", { name: "Ada" }), "Hello Ada");
console.log("multilingual_runtime: ok");
