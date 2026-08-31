import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("site/app/presentation.js", "utf8");
assert.match(source, /data-map-focus-tag/, "country cards must expose a map focus target");
assert.match(source, /data-map-focus-tag/, "country cards must expose a map focus target");
assert.match(source, /data-map-enter-tag/, "country cards must expose a separate detail entry target");
assert.match(source, /aria-pressed=\"\$\{String\(country\.tag === state\.selectedTag\)\}\"/, "country cards must expose their selected state");
assert.match(source, /rowDetailButton\("data-country-detail", country\.tag, "data-map-enter-tag"\)/, "country detail entry must use the shared map entry marker");
console.log("country_shared_layout: ok");
