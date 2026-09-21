import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sites = ["Victorian Century Database", "site/vc"];
for (const site of sites) {
  const presentation = fs.readFileSync(path.join(root, site, "app/presentation.js"), "utf8");
  const stateStatistics = fs.readFileSync(path.join(root, site, "app/state-statistics.js"), "utf8");
  const uiZh = fs.readFileSync(path.join(root, site, "locales/ui.zh-Hans.js"), "utf8");
  const html = fs.readFileSync(path.join(root, site, "index.html"), "utf8");
  assert.match(presentation, /key: "resources"/, `${site} should expose the resources country tab`);
  assert.match(presentation, /function countryDetailResourcesContent\(country\)/, `${site} should render country resources`);
  assert.match(presentation, /stateStatisticsGroupedResourceRows\(/, `${site} should reuse resource grouping`);
  assert.match(stateStatistics, /data-state-statistics-split-population/, `${site} should include split population folding`);
  assert.match(uiZh, /board\.country\.tabs\.resources/, `${site} should localize resources tab`);
  assert.match(html, /app\/state-statistics\.js\?v=20260921-state-statistics-ui3/, `${site} should load the current resources calculator`);
}

console.log("victorian_century_country_resources_contract: passed");
