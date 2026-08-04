import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const index = read("site/index.html");
const shell = read("site/styles/shell.css");
const appSources = fs.readdirSync(path.join(root, "site", "app"))
  .filter((file) => file.endsWith(".js"))
  .map((file) => [file, read(path.join("site", "app", file))]);
const locales = {
  "zh-Hans": readUiLocale("site/locales/ui.zh-Hans.js", "zh-Hans"),
  en: readUiLocale("site/locales/ui.en.js", "en"),
};

assert.match(index, /id="languageMenuButton"/);
assert.match(index, /assets\/lucide\/icons\/languages\.svg/);
assert.match(index, /data-locale="zh-Hans"[^>]*>简体中文/);
assert.match(index, /data-locale="en"[^>]*>English/);
assert(index.indexOf('src="app/runtime.js') < index.indexOf('src="app/i18n.js'), "i18n must load after runtime");
assert(index.indexOf('src="app/i18n.js') < index.indexOf('src="app/data.js'), "i18n must load before data");
assert.doesNotMatch(shell, /\.language-menu\s*\{[^}]*display:\s*none/i);

const referenced = new Set();
for (const match of index.matchAll(/data-i18n(?:-title|-aria-label|-placeholder)?="([^"]+)"/g)) referenced.add(match[1]);
for (const [, source] of appSources) {
  for (const match of source.matchAll(/\bt\(\s*["'`]([^"'`$]+)["'`]/g)) referenced.add(match[1]);
  for (const match of source.matchAll(/\btc\(\s*["'`]([^"'`$]+)["'`]/g)) {
    referenced.add(`${match[1]}.one`);
    referenced.add(`${match[1]}.other`);
  }
}

assert.deepEqual(Object.keys(locales.en).sort(), Object.keys(locales["zh-Hans"]).sort(), "UI locale dictionaries must have identical key sets");
for (const key of referenced) {
  for (const locale of ["zh-Hans", "en"]) assert(Object.hasOwn(locales[locale], key) && String(locales[locale][key]).length, `${locale} must define non-empty ${key}`);
}

if (strict) {
  const forbiddenFunctions = [
    ["boards.js", "renderHomeBoard"],
    ["boards.js", "renderSettingsDialogContent"],
    ["boards.js", "renderAboutDialogContent"],
    ["boards.js", "renderGlobalSearchDialogResults"],
    ["ui.js", "renderInfoDialog"],
    ["ui.js", "conceptTooltipActionHints"],
  ];
  for (const [file, functionName] of forbiddenFunctions) {
    const source = appSources.find(([name]) => name === file)?.[1] || "";
    assert.doesNotMatch(functionBody(source, functionName), /[\u3400-\u9fff]/u, `${file} ${functionName} must not contain fixed Chinese UI copy`);
  }
  const staticTextFailures = index.split(/\r?\n/).filter((line) => />\s*[\u3400-\u9fff][^<]*</u.test(line) && !/data-i18n(?:=|-)/.test(line) && !/data-locale=|announcement-data|Victoria 3 Wiki|Parawikis|官方/.test(line));
  assert.deepEqual(staticTextFailures, [], "static HTML text nodes must use data-i18n");
  const staticAttributeFailures = index.split(/\r?\n/).filter((line) => /(?:aria-label|title|placeholder)="[^"]*[\u3400-\u9fff][^"]*"/u.test(line) && !/data-i18n-(?:title|aria-label|placeholder)/.test(line));
  assert.deepEqual(staticAttributeFailures, [], "static HTML attributes must use data-i18n attributes");
  assert.doesNotMatch(appSources.map(([, source]) => source).join("\n"), /localeCompare\([^\n]*zh-Hans-CN/, "visible-name sorting must use localizedCompare");
}

console.log(JSON.stringify({ multilingual_ui_contracts: "ok", strict, referenced_keys: referenced.size }));

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function readUiLocale(relative, locale) {
  const sandbox = { window: {} };
  vm.runInNewContext(read(relative), sandbox, { filename: relative });
  return sandbox.window.VICDATA_UI_LOCALES?.[locale]?.messages || {};
}

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}
