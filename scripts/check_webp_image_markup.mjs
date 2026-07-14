import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const app = fs.readFileSync(path.join(process.cwd(), "site", "app.js"), "utf8");

assert.match(app, /function webpPictureHtml\(/, "missing WebP picture helper");
assert.match(app, /function loadImageCandidates\(/, "missing image candidate loader");
assert.match(app, /flatmap_votp\.webp/, "map should prefer WebP");
assert.match(app, /flatmap_votp\.png/, "map should retain PNG fallback");
assert.match(app, /imageUrl:\s*"assets\/map\/provinces\.png"/, "province lookup map must remain PNG");

for (const name of ["lawIconHtml", "buildingIconHtml", "companyIconHtml", "ideologyIconHtml"]) {
  const body = functionBody(app, name);
  assert.match(body, /webpPictureHtml\(/, `${name} should use WebP picture markup`);
}
for (const name of ["countryFlagIconHtml", "interestGroupIconHtml", "goodsIconHtml"]) {
  const body = functionBody(app, name);
  assert.doesNotMatch(body, /webpPictureHtml\(/, `${name} should remain PNG-only`);
}

console.log(JSON.stringify({ webp_image_markup: "ok" }, null, 2));

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `missing ${name}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}
