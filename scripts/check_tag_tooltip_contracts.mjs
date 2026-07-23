import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "site/app/components.js"),
  "utf8",
);
const definitionsPath = path.join(process.cwd(), "site/app/tag-tooltip-definitions.js");
assert.ok(fs.existsSync(definitionsPath), "tooltip definitions file is missing");
const definitionsSource = fs.readFileSync(definitionsPath, "utf8");
const indexSource = fs.readFileSync(path.join(process.cwd(), "site/index.html"), "utf8");

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
  definitionsSource,
  /const TAG_TOOLTIP_DEFINITIONS\s*=\s*{/,
  "TAG_TOOLTIP_DEFINITIONS object declaration is missing",
);
assert.doesNotMatch(
  source,
  /const TAG_TOOLTIP_DEFINITIONS\s*=/,
  "components.js must not own editable tooltip definitions",
);

for (const semanticKey of [
  "country-status:start",
  "country-status:releasable",
  "country-formation:major",
  "country-formation:minor",
  "country-status:special",
  "country-status:dual-heritage",
  "country-type:受认可国家",
  "country-type:殖民国家",
  "country-type:公司",
  "country-type:未受认可国家",
  "country-type:松散部族",
  "country-tier:城邦",
  "country-tier:公国",
  "country-tier:大公国",
  "country-tier:王国",
  "country-tier:帝国",
  "country-tier:霸权",
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
  assert.match(
    definitionsSource,
    new RegExp(`"${semanticKey}"\\s*:\\s*{[\\s\\S]{0,300}description\\s*:`),
    `TAG_TOOLTIP_DEFINITIONS is missing an explicit description for ${semanticKey}`,
  );
}

assert.match(definitionsSource, /const TAG_TOOLTIP_DEFAULTS\s*=\s*{/, "tooltip defaults declaration is missing");
assert.match(definitionsSource, /tag:\s*{[\s\S]{0,300}description:/, "tag description template is missing");
assert.match(definitionsSource, /concept:\s*{[\s\S]{0,300}description:/, "concept description template is missing");

assert.match(source, /function\s+tagTooltipMetadata\s*\(/);
assert.match(source, /function\s+conceptDataAttributes\s*\(/);

const tagTooltipMetadataSource = functionSource("tagTooltipMetadata");
assert.match(tagTooltipMetadataSource, /TAG_TOOLTIP_DEFINITIONS\[definitionKey\]/);
assert.match(tagTooltipMetadataSource, /TAG_TOOLTIP_DEFAULTS\.tag/);
assert.match(tagTooltipMetadataSource, /formatTooltipDescription\(/);

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
assert.match(uiSource, /TAG_TOOLTIP_DEFAULTS\.concept/, "concept tooltip fallback must use the definitions file");
assert.match(uiSource, /formatTooltipDescription\(/, "concept tooltip fallback must format the definitions template");
assert.match(recordStyles, /\.concept-tooltip-description\s*{[\s\S]*color:\s*var\(--ink\)/, "tooltip description style is missing");

for (const functionName of [
  "countryTagPills",
  "stateRegionTagPills",
  "strategicRegionTagPills",
  "geographicRegionTagPills",
  "companyTagPills",
  "companyPrestigeGoodPill",
  "traitPill",
  "ideologyPill",
]) {
  assert.match(source, new RegExp(`function\\s+${functionName}\\s*\\(`), `${functionName} tag generator is missing`);
}
assert.match(source, /function\s+refConceptPill\s*\([\s\S]*conceptPill\(/, "reference tags must stay on the concept-pill path");
assert.match(source, /function\s+buildingChip\s*\([\s\S]*conceptDataAttributes\(/, "state-region building tags must expose concept metadata");

const rootStyleSource = fs.readFileSync(path.join(process.cwd(), "site/styles.css"), "utf8");
const presentationSource = fs.readFileSync(path.join(process.cwd(), "site/app/presentation.js"), "utf8");
assert.match(indexSource, /styles\.css\?v=20260722-tag-tooltips1/, "main stylesheet cache version is missing");
assert.match(indexSource, /app\/ui\.js\?v=20260722-tag-tooltips1/, "tooltip UI cache version is missing");
assert.match(indexSource, /app\/tag-tooltip-definitions\.js\?v=20260723-tag-tooltip-definitions1/, "tooltip definitions cache version is missing");
assert.match(indexSource, /app\/components\.js\?v=20260723-tag-tooltip-definitions1/, "tooltip component cache version is missing");
assert.match(rootStyleSource, /styles\/records\.css\?v=20260722-tag-tooltips1/, "tooltip record-style cache version is missing");

const definitionsScriptOffset = indexSource.indexOf("app/tag-tooltip-definitions.js");
const componentsScriptOffset = indexSource.indexOf("app/components.js");
assert.ok(definitionsScriptOffset >= 0, "tooltip definitions script is missing");
assert.ok(componentsScriptOffset > definitionsScriptOffset, "tooltip definitions must load before components");

const conceptTagSource = functionSource("conceptTag");
assert.match(conceptTagSource, /conceptDataAttributes\s*\(/, "identity tags must use shared concept metadata");
assert.ok(!conceptTagSource.includes("title="), "identity tags must not emit browser-native titles");
assert.match(recordStyles, /\.concept-tag:hover/, "identity tags need the concept hover affordance");

for (const [name, kind] of [
  ["country.tag", "country"],
  ["stateRegion.key", "stateRegion"],
  ["culture.key", "culture"],
  ["company.key", "company"],
  ["ideology.key", "ideology"],
  ["law.key", "law"],
  ["region.key", "strategicRegion"],
]) {
  assert.match(presentationSource, new RegExp(`conceptTag\\(${name.replace(".", "\\.")}[^\\n]+"${kind}"`), `${kind} identity tags must use conceptTag`);
}
assert.doesNotMatch(presentationSource, /<span class="tag">\$\{escapeHtml\(/, "presentation identity tags must not bypass concept metadata");

console.log(JSON.stringify({ tag_tooltip_components: "ok" }));
