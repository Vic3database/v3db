import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync("site/index.html", "utf8");
const runtime = fs.readFileSync("site/app/runtime.js", "utf8");
const ui = fs.readFileSync("site/app/ui.js", "utf8");
const foundation = fs.readFileSync("site/styles/foundation.css", "utf8");
const shell = fs.readFileSync("site/styles/shell.css", "utf8");
const home = fs.readFileSync("site/styles/home.css", "utf8");

assert.match(runtime, /mapFullscreen/, "shared state must define map fullscreen state");
assert.match(ui, /function isMapView\s*\(/, "shared UI must define map view classification");
assert.match(ui, /function isContentView\s*\(/, "shared UI must define content view classification");
assert.match(ui, /function mapFullscreenRequested\s*\(/, "shared UI must parse map fullscreen state");
assert.match(html, /data-map-fullscreen/, "page shell must expose the fullscreen map control");
assert.match(html, /data-map-collapse/, "page shell must expose the collapse map control");
for (const variable of ["--layout-gap", "--filter-width", "--detail-width", "--card-gap", "--card-radius", "--state-border", "--state-selected"]) {
  assert.match(foundation, new RegExp(`${variable.replace("--", "\\-\\-")}\\s*:`), `foundation must define ${variable}`);
}
assert.match(shell, /data-page-mode|\.page-mode|\.layout/, "shared shell stylesheet must define page layout rules");
assert.match(home, /body\[data-view="interest-group"\]/, "interest-group layout must remain explicitly scoped");
assert.match(home, /body\[data-view="religion"\]/, "religion layout must remain explicitly scoped");
assert.doesNotMatch(html, /site\/vc\/index\.html/, "site/vc must not be treated as a source entry");
console.log("shared_layout_contract: ok");
