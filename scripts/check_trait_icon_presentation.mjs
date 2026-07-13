import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appSource = readText("site/app.js");
const styleSource = readText("site/styles.css");

assert.match(appSource, /function\s+traitIconHtml\s*\(/, "trait icon renderer should exist");
assert.match(appSource, /state-traits/, "state trait cards should reference state trait assets");
assert.match(appSource, /interest-group-traits/, "interest group trait cards should reference interest group trait assets");
assert.match(functionSource("stateTraitEffectList"), /traitIconHtml/, "state trait effect cards should render trait icons");
assert.match(functionSource("interestGroupTraitDetailCard"), /traitIconHtml/, "interest group trait cards should render trait icons");
assert.match(functionSource("interestGroupTraitDetailsHtml"), /interestGroupTraitDetailCard/, "flavored interest group traits should use the icon-bearing detail card");
assert.match(styleSource, /\.trait-card-layout\s*\{[\s\S]*grid-template-columns:\s*22px\s+minmax\(0,\s*1fr\)/, "trait card layout should reserve a fixed icon column");
assert.match(styleSource, /\.trait-icon\s*\{[\s\S]*width:\s*22px[\s\S]*height:\s*22px/, "trait icons should have a fixed size");

for (const relativePath of [
  "site/assets/state-traits/mountain.png",
  "site/assets/interest-group-traits/old_ways.png",
]) {
  assert.ok(fs.existsSync(path.join(root, relativePath)), `missing trait asset: ${relativePath}`);
}

console.log("trait_icon_presentation: ok");

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, "");
}

function functionSource(name) {
  const start = appSource.indexOf(`function ${name}`);
  if (start < 0) return "";
  const bodyStart = appSource.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") depth += 1;
    if (appSource[index] === "}") {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, index + 1);
    }
  }
  return appSource.slice(start);
}
