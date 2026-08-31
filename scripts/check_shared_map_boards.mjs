import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("site/app/presentation.js", "utf8");

assert.match(source, /data-map-focus-tag/, "country cards must expose map focus state");
assert.match(source, /data-map-focus-culture/, "culture cards must expose map focus state");
assert.match(source, /data-map-focus-region/, "region cards must expose map focus state");
assert.match(source, /data-map-focus-company/, "company cards must expose map focus state");
assert.match(source, /data-map-enter-tag/, "country cards must expose map detail entry");
assert.match(source, /data-map-enter-culture/, "culture cards must expose map detail entry");
assert.match(source, /data-map-enter-region/, "region cards must expose map detail entry");
assert.match(source, /data-map-enter-company/, "company cards must expose map detail entry");
assert.match(source, /selectCompanyCard\(row\.dataset\.company\)/, "company card body must only select the company");
assert.doesNotMatch(source, /if \(event\.target\.closest\("a, button, \[data-concept-key\]\)\) return;\s*openCompanyDetail\(row\.dataset\.company\)/, "company card body must not directly open detail");
assert.doesNotMatch(fs.readFileSync("site/styles/shell.css", "utf8"), /body\[data-view="company"\] \.map-panel/, "company map must remain visible in the map mode");
console.log("shared_map_boards: ok");
