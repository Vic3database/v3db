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
assert.match(ui, /matchMedia\("\(max-width: 760px\)"\)/, "map fullscreen state must be limited to narrow screens");
assert.match(ui, /function enterMapFullscreen\s*\(/, "shared UI must enter map fullscreen through one transition");
assert.match(ui, /function exitMapFullscreen\s*\(/, "shared UI must exit map fullscreen through one transition");
assert.match(ui, /createMapFullscreenSnapshot|mapFullscreenSnapshot/, "shared UI must preserve map fullscreen state");
assert.match(html, /data-map-fullscreen/, "page shell must expose the fullscreen map control");
assert.match(html, /data-map-collapse/, "page shell must expose the collapse map control");
assert.match(html, /data-map-fullscreen[^>]*>\s*<img[^>]+src="assets\/lucide\/icons\/fullscreen\.svg"/, "fullscreen control must use the fullscreen icon only");
assert.match(html, /data-map-collapse[^>]*>\s*<img[^>]+src="assets\/lucide\/icons\/minimize-2\.svg"/, "collapse control must use the minimize icon only");
assert.doesNotMatch(html, /data-map-fullscreen[^>]*>[\s\S]*?全屏[\s\S]*?<\/button>/, "fullscreen control must not contain visible Chinese text");
assert.doesNotMatch(html, /data-map-collapse[^>]*>[\s\S]*?收起[\s\S]*?<\/button>/, "collapse control must not contain visible Chinese text");
for (const view of ["country", "culture", "region"]) {
  assert.match(shell, new RegExp(`body\\[data-page-mode="map"\\][\\s\\S]*${view}|body\\[data-view="${view}"\\]`), `narrow map layout must include ${view} view`);
}
assert.match(ui, /function isContentView\s*\(view\)\s*{[\s\S]*"company"/, "company must use the content page mode");
assert.match(shell, /body\[data-map-fullscreen="true"\] \.map-panel[\s\S]*position:\s*fixed/, "fullscreen map override must be defined");
assert.match(shell, /@media\s*\(min-width:\s*761px\)[\s\S]*\.map-fullscreen-button[\s\S]*display:\s*none\s*!important/, "map fullscreen controls must be hidden on desktop");
for (const variable of ["--layout-gap", "--filter-width", "--detail-width", "--card-gap", "--card-radius", "--state-border", "--state-selected"]) {
  assert.match(foundation, new RegExp(`${variable.replace("--", "\\-\\-")}\\s*:`), `foundation must define ${variable}`);
}
assert.match(shell, /data-page-mode|\.page-mode|\.layout/, "shared shell stylesheet must define page layout rules");
assert.match(home, /body\[data-view="interest-group"\]/, "interest-group layout must remain explicitly scoped");
assert.match(home, /body\[data-view="religion"\]/, "religion layout must remain explicitly scoped");
assert.doesNotMatch(html, /site\/vc\/index\.html/, "site/vc must not be treated as a source entry");
console.log("shared_layout_contract: ok");
