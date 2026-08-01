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
const runtimeSource = fs.readFileSync(path.join(process.cwd(), "site/app/runtime.js"), "utf8");

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
  "country-type:公司国家",
  "country-type:未受认可国家",
  "country-type:松散政权",
  "country-tier:城邦",
  "country-tier:公国",
  "country-tier:大公国",
  "country-tier:王国",
  "country-tier:帝国",
  "country-tier:霸权",
]) {
  assert.match(
    definitionsSource,
    new RegExp(`"${semanticKey}"\\s*:`),
    `TAG_TOOLTIP_DEFINITIONS is missing ${semanticKey}`,
  );
}

for (const semanticKey of [
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
    new RegExp(`"${semanticKey}"\\s*:`),
    `TAG_TOOLTIP_DEFINITIONS is missing ${semanticKey}`,
  );
}

assert.match(definitionsSource, /const TAG_TOOLTIP_DEFAULTS\s*=\s*{/, "tooltip defaults declaration is missing");
for (const defaultKey of ["tag", "building", "goods", "technology", "stateTrait", "culture", "cultureTrait", "cultureTraitGroup"]) {
  assert.match(
    definitionsSource,
    new RegExp(`${defaultKey}:\\s*{[\\s\\S]{0,300}category:`),
    `${defaultKey} category default is missing`,
  );
}
assert.match(definitionsSource, /concept:\s*{\s*}/, "concept default must permit an empty description");
for (const definitionKey of [
  "tag-heritage-group",
  "tag-heritage",
  "tag-language-group",
  "tag-language",
  "tag-tradition",
]) {
  assert.match(
    definitionsSource,
    new RegExp(`"${definitionKey}"\\s*:`),
    `${definitionKey} definition is missing`,
  );
}
assert.match(runtimeSource, /function\s+formatTooltipDescription\s*\(/, "tooltip template formatter is missing");

assert.match(source, /function\s+tagTooltipMetadata\s*\(/);
assert.match(source, /function\s+conceptDataAttributes\s*\(/);

const tagTooltipMetadataSource = functionSource("tagTooltipMetadata");
assert.match(tagTooltipMetadataSource, /TAG_TOOLTIP_DEFINITIONS\[definitionKey\]/);
assert.match(tagTooltipMetadataSource, /TAG_TOOLTIP_DEFAULTS\.tag/);
assert.match(tagTooltipMetadataSource, /formatTooltipDescription\(/);
assert.match(source, /function\s+conceptTooltipMetadata\s*\(/, "concept tooltip metadata resolver is missing");

for (const functionName of ["groupedTraitPills", "refConceptPill", "traitPill", "traitGroupPill", "conceptTag"]) {
  assert.match(functionSource(functionName), /conceptTooltipMetadata\(/, `${functionName} must use culture tooltip metadata`);
}

const countryTagPillsSource = functionSource("countryTagPills");
assert.match(countryTagPillsSource, /`country-type:\$\{countryTypeTagLabel\(country\)\}`/);
assert.match(countryTagPillsSource, /`country-tier:\$\{country\.tier \|\| ""\}`/);

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
assert.match(buildingChipSource, /TAG_TOOLTIP_DEFAULTS\.building/);
assert.match(buildingChipSource, /formatTooltipDescription\(/);
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

function sourceFunction(sourceText, name) {
  const declaration = new RegExp(`function\\s+${name}\\s*\\(`).exec(sourceText);
  assert.ok(declaration, `function ${name} is missing`);

  const openingBrace = sourceText.indexOf("{", declaration.index);
  assert.notEqual(openingBrace, -1, `function ${name} has no body`);

  let depth = 0;
  for (let index = openingBrace; index < sourceText.length; index += 1) {
    if (sourceText[index] === "{") depth += 1;
    if (sourceText[index] === "}") depth -= 1;
    if (depth === 0) return sourceText.slice(declaration.index, index + 1);
  }

  assert.fail(`function ${name} has an unterminated body`);
}

assert.match(uiSource, /function\s+conceptTooltipDescription\s*\(/, "concept tooltip description resolver is missing");
assert.match(uiSource, /function\s+suppressNativeTooltip\s*\(/, "native tooltip suppression helper is missing");
assert.match(uiSource, /scheduleConceptTooltip[\s\S]*suppressNativeTooltip\(target\)/, "native tooltip suppression must run before the hover delay");
assert.match(uiSource, /dataset\.conceptDescription/, "concept tooltip must read explicit tag descriptions");
assert.match(uiSource, /concept-tooltip-description/, "concept tooltip must render a readable description row");
assert.match(uiSource, /TAG_TOOLTIP_DEFAULTS\.concept/, "concept tooltip fallback must use the definitions file");
assert.match(uiSource, /formatTooltipDescription\(/, "concept tooltip fallback must format the definitions template");
assert.match(recordStyles, /\.concept-tooltip-description\s*{[\s\S]*color:\s*var\(--ink\)/, "tooltip description style is missing");

assert.match(
  definitionsSource,
  /cultureRelations:\s*{[\s\S]*heritageGroup:[\s\S]*heritage:[\s\S]*languageGroup:[\s\S]*language:[\s\S]*tradition:[\s\S]*primaryCultureCountries:[\s\S]*obsessions:[\s\S]*taboos:/,
  "culture relation labels are missing from tooltip definitions",
);
assert.match(uiSource, /function\s+cultureTooltipRelationSections\s*\(/, "culture relation resolver is missing");
assert.match(uiSource, /function\s+cultureTooltipRelationSection\s*\(/, "culture relation renderer is missing");
assert.ok(/function\s+conceptTooltipHeader\s*\(/.test(uiSource), "generic tooltip header renderer is missing");
assert.ok(/function\s+conceptTooltipContent\s*\(/.test(uiSource), "generic tooltip content renderer is missing");
assert.ok(/function\s+conceptTooltipActionHints\s*\(/.test(uiSource), "generic tooltip action resolver is missing");
assert.ok(/concept-tooltip-head/.test(uiSource), "generic tooltip must render a two-column header");
assert.ok(/concept-tooltip-divider/.test(uiSource), "generic tooltip must separate header, content, and actions");
assert.match(uiSource, /左键进入详情页/, "generic tooltip must name the detail action");
assert.match(uiSource, /右键进行筛选/, "generic tooltip must name the filter action");
assert.match(uiSource, /\$\{group\.type_zh\}特质组/, "heritage groups must identify themselves as trait groups");
assert.match(uiSource, /cultureTraitGroupByKey\.get\(key\)/, "culture trait groups must resolve from their own index");
assert.match(uiSource, /related_countries/, "culture tooltip must show primary-culture countries");
assert.match(uiSource, /obsessions/, "culture tooltip must show obsessions");
assert.match(uiSource, /taboos/, "culture tooltip must show taboos");
assert.ok(/\.concept-tooltip\.standard-tooltip\s*{/.test(recordStyles), "generic tooltip layout is missing");
assert.ok(/\.concept-tooltip-head\s*{/.test(recordStyles), "generic tooltip header style is missing");
assert.ok(/\.concept-tooltip-divider\s*{/.test(recordStyles), "generic tooltip divider style is missing");
assert.doesNotMatch(uiSource, /cultureTooltipRelationSection[\s\S]{0,1200}conceptPill\s*\(/, "culture relations must not create nested concept pills");
assert.doesNotMatch(uiSource, /cultureTooltipRelationSection[\s\S]{0,1200}title=/, "culture relations must not emit native titles");
assert.doesNotMatch(sourceFunction(uiSource, "ideologyTooltipRows"), /conceptTooltipHeader|conceptTooltipContent/, "ideology tooltip must retain its dedicated layout");
assert.equal(
  [...sourceFunction(uiSource, "conceptTooltipRows").matchAll(/concept-tooltip-divider/g)].length,
  2,
  "generic tooltip must render two divider positions",
);

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
assert.match(indexSource, /styles\.css\?v=[^"']+/, "main stylesheet cache version is missing");
assert.match(indexSource, /app\/runtime\.js\?v=[^"']+/, "tooltip runtime cache version is missing");
assert.match(indexSource, /app\/ui\.js\?v=[^"']+/, "tooltip UI cache version is missing");
assert.match(indexSource, /app\/tag-tooltip-definitions\.js\?v=[^"']+/, "tooltip definitions cache version is missing");
assert.match(indexSource, /app\/components\.js\?v=[^"']+/, "tooltip component cache version is missing");
assert.match(rootStyleSource, /styles\/records\.css\?v=[^"']+/, "tooltip record-style cache version is missing");

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
  ["ideology.key", "ideology"],
  ["law.key", "law"],
  ["region.key", "strategicRegion"],
]) {
  assert.match(presentationSource, new RegExp(`conceptTag\\(${name.replace(".", "\\.")}[^\\n]+"${kind}"`), `${kind} identity tags must use conceptTag`);
}
assert.doesNotMatch(presentationSource, /conceptTag\(company\.key[^\n]+"company"/, "company IDs must not render as tags");
assert.doesNotMatch(presentationSource, /<span class="tag">\$\{escapeHtml\(/, "presentation identity tags must not bypass concept metadata");

console.log(JSON.stringify({ tag_tooltip_components: "ok" }));
