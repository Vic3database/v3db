import assert from "node:assert/strict";
import fs from "node:fs";

const runtime = fs.readFileSync("site/app/runtime.js", "utf8");
const ui = fs.readFileSync("site/app/ui.js", "utf8");
const presentation = fs.readFileSync("site/app/presentation.js", "utf8");
const content = fs.readFileSync("site/app/content-country-links.js", "utf8");

assert.match(runtime, /countryDetailFlavorTab\s*:/, "runtime must store the selected flavor subtab");
assert.match(ui, /function countryFlavorTabFromQuery\s*\(/, "country route must parse the flavor subtab");
assert.match(presentation, /function countryFlavorTabs\s*\(/, "country detail must define flavor subtabs");
assert.match(presentation, /function countryFlavorTabContent\s*\(/, "country detail must render the selected flavor subtab");
assert.match(presentation, /data-country-flavor-tab/, "flavor subtabs must expose interaction targets");
assert.match(presentation, /contentByCountry/, "flavor subtabs must reuse the country content reverse index");
assert.match(content, /function countryContentSectionHtml\s*\(/, "flavor content must reuse existing content cards");

const data = fs.readFileSync("site/versions/1.13.11/data-content.js", "utf8");
assert.match(data, /"CHI"[\s\S]*"journals"/, "China must have country flavor content data");
assert.match(data, /"CHI"[\s\S]*"events"/, "China must have country flavor event data");

console.log("country_detail_flavor_tabs: ok");
