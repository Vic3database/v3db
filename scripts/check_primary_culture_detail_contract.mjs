import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8").replace(/^\uFEFF/, "");
const presentation = read("site/app/presentation.js");
const recordsCss = read("site/styles/records.css");
const styles = read("site/styles.css");
const indexHtml = read("site/index.html");
const zhUi = read("site/locales/ui.zh-Hans.js");
const enUi = read("site/locales/ui.en.js");

assert.ok(/function countryPrimaryCultureExpansionsHtml\(country\)/.test(presentation), "country detail needs an expansion renderer");
assert.ok(/primaryCultureConditionalPaths/.test(presentation), "renderer must use projected condition paths");
assert.ok(/primaryCultureOptionGroups/.test(presentation), "renderer must expose exclusive route groups");
assert.ok(/primaryCultureReplacementPaths/.test(presentation), "renderer must expose replacement paths");
assert.ok(/data-country-primary-culture-expansions/.test(presentation), "renderer needs a stable browser-test root");
assert.ok(/country-primary-culture-expansion/.test(recordsCss), "detail entries need dedicated wrapping styles");
assert.ok(/styles\/records\.css\?v=20260825-primary-culture-paths1/.test(styles), "records stylesheet cache token must change");
assert.ok(/app\/presentation\.js\?v=20260825-primary-culture-paths1/.test(indexHtml), "presentation cache token must change");

const keys = [
  "board.country.expandablePrimaryCultures",
  "board.country.primaryCulturePath.direct",
  "board.country.primaryCulturePath.conditional",
  "board.country.primaryCulturePath.exclusive",
  "board.country.primaryCulturePath.replacement",
  "board.country.primaryCulturePath.condition",
  "board.country.primaryCulturePath.mutuallyExclusiveRoutes",
  "board.country.primaryCulturePath.source",
  "board.country.primaryCulturePath.file",
  "board.country.primaryCulturePath.line",
  "board.country.primaryCulturePath.homelandCulture",
  "board.country.primaryCulturePath.formedFrom",
  "board.country.primaryCulturePath.currentPrimaryCultures",
  "board.country.primaryCulturePath.culturePresent",
  "board.country.primaryCulturePath.integrationDecision",
  "board.country.primaryCulturePath.acceptanceLevel",
  "board.country.primaryCulturePath.vernacularDevelopment",
  "board.country.primaryCulturePath.unifyAfghanistanJournal",
  "board.country.primaryCulturePath.replaces",
  "board.country.primaryCulturePath.sourceType.event",
  "board.country.primaryCulturePath.sourceType.journal",
  "board.country.primaryCulturePath.sourceType.onAction",
  "board.country.primaryCulturePath.sourceType.scripted",
  "board.country.primaryCulturePath.sourceType.scriptedButton",
  "board.country.primaryCulturePath.sourceType.scriptedEffect",
  "board.country.primaryCulturePath.sourceType.amendment",
];
for (const key of keys) {
  const matcher = new RegExp(`"${key.replaceAll(".", "\\.")}"`);
  assert.ok(matcher.test(zhUi), `Chinese UI locale must include ${key}`);
  assert.ok(matcher.test(enUi), `English UI locale must include ${key}`);
}

console.log("primary culture detail contract passed");
