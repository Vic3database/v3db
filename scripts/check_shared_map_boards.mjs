import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("site/app/presentation.js", "utf8");

assert.match(source, /data-map-focus-tag/, "country cards must expose map focus state");
assert.match(source, /data-map-focus-culture/, "culture cards must expose map focus state");
assert.match(source, /data-map-focus-region/, "region cards must expose map focus state");
assert.match(source, /data-map-enter-tag/, "country cards must expose map detail entry");
assert.match(source, /data-map-enter-culture/, "culture cards must expose map detail entry");
assert.match(source, /data-map-enter-region/, "region cards must expose map detail entry");
assert.doesNotMatch(source, /data-map-focus-company|data-map-enter-company/, "company cards must not expose map-only controls");
assert.match(source, /row\.addEventListener\("click"[\s\S]*openCompanyDetail\(row\.dataset\.company\)/, "company card body must open detail directly");
console.log("shared_map_boards: ok");
