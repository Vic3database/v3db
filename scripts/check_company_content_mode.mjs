import assert from "node:assert/strict";
import fs from "node:fs";

const ui = fs.readFileSync("site/app/ui.js", "utf8");
const presentation = fs.readFileSync("site/app/presentation.js", "utf8");
const boards = fs.readFileSync("site/app/boards.js", "utf8");
const shell = fs.readFileSync("site/styles/shell.css", "utf8");

assert.match(ui, /function isMapView\s*\(view\)\s*{[\s\S]*\["country", "culture", "region"\]/, "company must not be classified as a map view");
assert.match(ui, /function isContentView\s*\(view\)\s*{[\s\S]*"company"/, "company must be classified as a content view");
assert.doesNotMatch(boards, /renderCompanyList\(filtered\);[\s\S]*renderMap\(companyMapStateRegions/, "company board must not render the main map");
assert.match(presentation, /row\.addEventListener\("click"[\s\S]*openCompanyDetail\(row\.dataset\.company\)/, "company card click must open detail directly");
assert.match(presentation, /row\.addEventListener\("keydown"[\s\S]*openCompanyDetail\(row\.dataset\.company\)/, "company card keyboard activation must open detail directly");
assert.doesNotMatch(presentation, /rowDetailButton\([\s\S]*data-company-detail|data-map-enter-company/, "company cards must not render a separate map entry button");
assert.match(shell, /body\[data-view="company"\] \.map-panel[\s\S]*display:\s*none/, "company list and detail pages must hide the main map");
assert.match(presentation, /data-company-location-map/, "company details must retain the auxiliary location map");
assert.doesNotMatch(ui, /parts\[0\] === "company" && !parts\[1][\s\S]*mapFullscreenRequested/, "company list route must not enter map fullscreen");
assert.ok(shell.includes('body.detail-page[data-view="company"]') && shell.includes('right: calc(12px + var(--right-panel-width) + var(--panel-gap));'), "company detail must reserve the right detail panel");
assert.ok(shell.includes('body.detail-page[data-view="company"]') && shell.includes('width: var(--right-panel-width);'), "company detail must use the shared right panel width");
assert.ok(shell.includes('body.detail-page[data-view="company"]') && shell.includes('.results') && shell.includes('display: none;'), "narrow company detail must hide the company list");
console.log("company_content_mode: ok");
