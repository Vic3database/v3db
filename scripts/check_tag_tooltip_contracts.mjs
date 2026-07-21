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
const tagTooltipDefinitionsStart = source.indexOf("const TAG_TOOLTIP_DEFINITIONS");
const tagTooltipDefinitionsEnd = source.indexOf("]);", tagTooltipDefinitionsStart);
assert.notEqual(tagTooltipDefinitionsEnd, -1, "TAG_TOOLTIP_DEFINITIONS has no closing delimiter");
const tagTooltipDefinitionsSource = source.slice(tagTooltipDefinitionsStart, tagTooltipDefinitionsEnd + 3);

for (const semanticKey of [
  "country-status:releasable",
  "country-formation:major",
  "country-formation:minor",
  "country-status:special",
  "country-status:dual-heritage",
]) {
  assert.ok(
    tagTooltipDefinitionsSource.includes(`["${semanticKey}"`),
    `TAG_TOOLTIP_DEFINITIONS is missing ${semanticKey}`,
  );
}

for (const classKey of [
  "tag-type",
  "tag-tier",
  "tag-region",
  "tag-heritage",
  "tag-language",
  "tag-tradition",
  "tag-dlc",
  "tag-good",
  "tag-vc",
  "tag-arable",
  "tag-more",
  "tag-muted",
]) {
  assert.ok(
    tagTooltipDefinitionsSource.includes(`["${classKey}"`),
    `TAG_TOOLTIP_DEFINITIONS is missing the ${classKey} category`,
  );
}

assert.match(source, /country-status:start[\s\S]{0,500}开局/);
assert.match(source, /country-status:start[\s\S]{0,500}1836年开局时已存在/);
assert.match(source, /country-type:殖民国家[\s\S]{0,500}殖民地/);
assert.match(source, /country-tier:公国[\s\S]{0,500}国家位阶/);

assert.match(source, /function\s+tagTooltipMetadata\s*\(/);
assert.match(source, /function\s+conceptDataAttributes\s*\(/);

const tagTooltipMetadataSource = functionSource("tagTooltipMetadata");
assert.match(tagTooltipMetadataSource, /definition\.category\s*\|\|\s*"属性标签"/);
assert.match(tagTooltipMetadataSource, /“\$\{label\}”用于标示当前条目的\$\{category\}。/);

const countryTagPillsSource = functionSource("countryTagPills");
assert.match(countryTagPillsSource, /`country-type:\$\{countryTypeTagLabel\(country\)\}`/);
assert.match(countryTagPillsSource, /`country-tier:\$\{country\.tierZh \|\| ""\}`/);

const statusPillsSource = functionSource("statusPills");
for (const semanticKey of [
  "country-status:start",
  "country-status:releasable",
  "country-formation:major",
  "country-formation:minor",
  "country-status:special",
  "country-status:dual-heritage",
]) {
  assert.ok(statusPillsSource.includes(`"${semanticKey}"`), `statusPills is missing ${semanticKey}`);
}

const tagPillSource = functionSource("tagPill");
assert.match(tagPillSource, /conceptPill\s*\(/);
assert.match(tagPillSource, /kind:\s*"tag"/);
assert.match(tagPillSource, /description\s*:/);
assert.match(tagPillSource, /category:\s*metadata\.category/);
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
assert.match(companyDlcIconPillSource, /dlcIconHtml\s*\(/);

assert.ok(!functionSource("goodsIconHtml").includes("title="));
assert.ok(!functionSource("buildingIconHtml").includes("title="));
assert.ok(!functionSource("dlcIconHtml").includes("title="));

const uiSource = fs.readFileSync(
  path.join(process.cwd(), "site/app/ui.js"),
  "utf8",
);
const recordStyles = fs.readFileSync(
  path.join(process.cwd(), "site/styles/records.css"),
  "utf8",
);

assert.match(uiSource, /function\s+conceptTooltipDescription\s*\(/, "concept tooltip description resolver is missing");
assert.match(uiSource, /function\s+suppressNativeTooltip\s*\(/, "native tooltip suppression helper is missing");
assert.match(uiSource, /scheduleConceptTooltip[\s\S]*suppressNativeTooltip\(target\)/, "native tooltip suppression must run before the hover delay");
assert.match(uiSource, /dataset\.conceptDescription/, "concept tooltip must read explicit tag descriptions");
assert.match(uiSource, /concept-tooltip-description/, "concept tooltip must render a readable description row");
assert.match(recordStyles, /\.concept-tooltip-description\s*{[\s\S]*color:\s*var\(--ink\)/, "tooltip description style is missing");

console.log(JSON.stringify({ tag_tooltip_components: "ok" }));
