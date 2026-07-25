import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const uiSources = [
  "site/app/boards.js",
  "site/app/company-location-rules.js",
  "site/app/components.js",
  "site/app/data.js",
  "site/app/filters.js",
  "site/app/map.js",
  "site/app/presentation.js",
  "site/app/ui.js",
].map((relativePath) => [relativePath, read(relativePath)]);
const generatorSources = [
  "scripts/build_changelog_data.mjs",
  "scripts/extract_vic3_countries.mjs",
].map((relativePath) => [relativePath, read(relativePath)]);

for (const [relativePath, source] of [...uiSources, ...generatorSources]) {
  assert.equal(/州地区|本土州|日志：|事件\/日志(?!条目)/.test(source), false, `${relativePath} still contains outdated localized terminology`);
}

const tooltipDefinitions = read("site/app/tag-tooltip-definitions.js");
const indexSource = read("site/index.html");
assert.match(tooltipDefinitions, /"company-ownership-category"\s*:\s*\{\s*category:\s*"控股类别"\s*\}/, "company ownership category tooltip definition is missing");
assert.match(tooltipDefinitions, /"tag-region"\s*:\s*\{\s*category:\s*"区域关系"\s*\}/, "generic region tag category must avoid conflating region types");
assert.match(tooltipDefinitions, /"country-tier"\s*:\s*\{\s*category:\s*"国家位阶"\s*\}/, "country tier must remain distinct from international rank");
assert.equal(/州地区|本土州|日志：|事件\/日志(?!条目)/.test(indexSource), false, "site index still contains outdated localized terminology");

const components = read("site/app/components.js");
const presentation = read("site/app/presentation.js");
assert.match(functionSource(components, "companyTagPills"), /company-ownership-category:/, "company list ownership tag must use its dedicated semantic key");
assert.match(presentation, /company-ownership-category:/, "company detail ownership tag must use its dedicated semantic key");
assert.doesNotMatch(functionSource(components, "companyTagPills"), /tagPill\([^\n]*"tag-tier"/, "company list ownership tag must not use the tier class");
assert.doesNotMatch(presentation, /控股类别[\s\S]{0,200}"tag-tier"/, "company detail ownership tag must not use the tier class");

console.log(JSON.stringify({ localized_terminology: "ok" }));

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) return "";
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  return source.slice(start);
}
