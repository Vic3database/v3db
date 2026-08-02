import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const indexSource = readText("site/index.html");
const runtimeSource = readText("site/app/runtime.js");
const uiSource = readText("site/app/ui.js");
const mapSource = readText("site/app/map.js");

assert.ok(/id="stateTraitMapViewButton"/.test(indexSource), "region filters should expose the state-trait view button");
assert.ok(/stateTraitMapViewButton: document\.querySelector\("#stateTraitMapViewButton"\)/.test(runtimeSource), "runtime should expose the state-trait button");
assert.ok(/state\.regionMapView = state\.regionMapView === "traits" \? "default" : "traits"/.test(functionSource(uiSource, "bindEvents")), "trait button should toggle the trait view");
assert.ok(/state\.regionMapView === "traits"[\s\S]*state\.mapMode = "traitIcons"/.test(functionSource(mapSource, "syncMapModeForView")), "trait view should take precedence over region resource mode");

console.log(JSON.stringify({ state_trait_map: "ok" }, null, 2));

function readText(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8").replace(/^\uFEFF/, "");
}

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) return "";
  const signatureEnd = source.indexOf(")", start);
  const bodyStart = source.indexOf("{", signatureEnd);
  if (bodyStart < 0) return "";
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return source.slice(start);
}
