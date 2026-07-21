import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "site/app/components.js"),
  "utf8",
);

function functionSource(name) {
  const declaration = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(declaration, `function ${name} is missing`);

  const openingBrace = source.indexOf("{", declaration.index);
  assert.notEqual(openingBrace, -1, `function ${name} has no body`);

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(declaration.index, index + 1);
  }

  assert.fail(`function ${name} has an unterminated body`);
}

assert.match(
  source,
  /const TAG_TOOLTIP_DEFINITIONS\s*=\s*new Map\s*\(/,
  "TAG_TOOLTIP_DEFINITIONS Map declaration is missing",
);
assert.match(source, /country-status:start[\s\S]{0,500}开局/);
assert.match(source, /country-status:start[\s\S]{0,500}1836年开局时已存在/);
assert.match(source, /country-type:殖民国家[\s\S]{0,500}殖民地/);
assert.match(source, /country-tier:公国[\s\S]{0,500}国家位阶/);

assert.match(source, /function\s+tagTooltipMetadata\s*\(/);
assert.match(source, /function\s+conceptDataAttributes\s*\(/);

const tagPillSource = functionSource("tagPill");
assert.match(tagPillSource, /conceptPill\s*\(/);
assert.match(tagPillSource, /kind:\s*"tag"/);
assert.match(tagPillSource, /description\s*:/);
assert.match(tagPillSource, /hideNativeTitle:\s*true/);

const conceptPillSource = functionSource("conceptPill");
assert.ok(!conceptPillSource.includes("title="));

const buildingChipSource = functionSource("buildingChip");
assert.match(buildingChipSource, /conceptDataAttributes\s*\(/);
assert.match(buildingChipSource, /kind:\s*"building"/);
assert.ok(!buildingChipSource.includes("title="));

const companyDlcIconPillSource = functionSource("companyDlcIconPill");
assert.match(companyDlcIconPillSource, /tagPill\s*\(/);
assert.match(companyDlcIconPillSource, /company-dlc:/);

assert.ok(!functionSource("goodsIconHtml").includes("title="));
assert.ok(!functionSource("buildingIconHtml").includes("title="));
assert.ok(!functionSource("dlcIconHtml").includes("title="));

console.log(JSON.stringify({ tag_tooltip_components: "ok" }));
