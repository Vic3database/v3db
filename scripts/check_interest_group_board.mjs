import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readChunkedSiteData } from "./site_data_reader.mjs";
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appSource = readSiteAppSource(root);
const styleSource = readSiteStyleSource(root);
const indexSource = fs.readFileSync(path.join(root, "site/index.html"), "utf8");
const stylesEntrySource = fs.readFileSync(path.join(root, "site/styles.css"), "utf8");
const i18nSource = fs.readFileSync(path.join(root, "site/app/i18n.js"), "utf8");
const zhUi = fs.readFileSync(path.join(root, "site/locales/ui.zh-Hans.js"), "utf8");
const enUi = fs.readFileSync(path.join(root, "site/locales/ui.en.js"), "utf8");
const siteData = readChunkedSiteData(root);
const expectedKeys = [
  "ig_landowners",
  "ig_petty_bourgeoisie",
  "ig_devout",
  "ig_rural_folk",
  "ig_intelligentsia",
  "ig_industrialists",
  "ig_armed_forces",
  "ig_trade_unions",
];
const expectedPalette = {
  ig_landowners: { standard: "#6A6AB0", background: "#1B1B2C", text: "#6A6AB0" },
  ig_petty_bourgeoisie: { standard: "#3D26B7", background: "#0F0A2E", text: "#B8A8F2" },
  ig_devout: { standard: "#4AAAB3", background: "#132B2D", text: "#4AAAB3" },
  ig_rural_folk: { standard: "#449977", background: "#11261E", text: "#449977" },
  ig_intelligentsia: { standard: "#E48B0A", background: "#392303", text: "#E48B0A" },
  ig_industrialists: { standard: "#E47639", background: "#391E0E", text: "#E47639" },
  ig_armed_forces: { standard: "#634740", background: "#191210", text: "#C6A988" },
  ig_trade_unions: { standard: "#942828", background: "#250A0A", text: "#D68A8A" },
};
const expectedInterestGroupIconFiles = [
  "landowners.webp",
  "petty_bourgeoisie.webp",
  "devout.webp",
  "rural_folk.webp",
  "intelligensia.webp",
  "industrialists.webp",
  "armed_forces.webp",
  "trade_unions.webp",
];

assert.equal(siteData.interestGroups?.length, 8, "site data must contain eight base interest groups");
assert.deepEqual(
  expectedKeys.filter((key) => !siteData.interestGroups?.some((group) => group.key === key)),
  [],
  "site data is missing a base interest group",
);

assert.match(indexSource, /data-nav-view="interest-group"/, "top navigation needs an interest-group entry");
assert.match(indexSource, /value="interest-group"/, "hidden board switch needs an interest-group option");
assert.match(appSource, /assets\/technologies\/corporatism\.webp/, "the home interest-group entry must use the corporatism technology icon");
assert.match(appSource, /replace\(\/\\\.dds\$\/i, "\.webp"\)/, "interest-group icons must use WebP assets");
for (const fileName of expectedInterestGroupIconFiles) {
  assert.ok(fs.existsSync(path.join(root, "site", "assets", "interest-groups", fileName)), `missing WebP interest-group icon: ${fileName}`);
}
assert.ok(fs.existsSync(path.join(root, "site", "assets", "technologies", "corporatism.webp")), "missing corporatism technology WebP");
const topbarNavigationItems = [...indexSource.matchAll(/<button class="topbar-nav-item"[^>]*>([\s\S]*?)<\/button>/g)];
assert.ok(topbarNavigationItems.length > 0, "top navigation needs board entries");
assert.ok(topbarNavigationItems.every(([, content]) => !/<img\b/.test(content)), "top navigation board entries must not contain icons");
assert.match(indexSource, /styles\.css\?v=20260810-topbar-cache1/, "interest-group stylesheet cache version is stale");
assert.match(stylesEntrySource, /home\.css\?v=20260810-interest-group-tooltip-layout1/, "interest-group home stylesheet cache version is stale");
for (const script of ["runtime", "ui"]) {
  assert.match(indexSource, new RegExp(`app/${script}\\.js\\?v=20260810-interest-group-tooltip-layout1`), `${script} cache version is stale`);
}
assert.match(indexSource, /app\/boards\.js\?v=20260810-interest-group-tooltip-layout1/, "interest-group board script cache version is stale");
assert.match(indexSource, /app\/i18n\.js\?v=20260810-global-search-interest-group-flavors1/, "locale bootstrap cache version is stale");
assert.match(i18nSource, /v=20260810-global-search-interest-group-flavors1/, "dynamic locale cache version is stale");
assert.match(appSource, /interestGroup\.singleCountryTraitVariant/, "single-country trait variants must use the interest-group and country naming template");
assert.match(zhUi, /interestGroup\.singleCountryTraitVariant/, "Chinese single-country trait variant template is missing");
assert.match(enUi, /interestGroup\.singleCountryTraitVariant/, "English single-country trait variant template is missing");
assert.match(appSource, /function\s+renderInterestGroupBoard\s*\(/, "interest-group board renderer is missing");
assert.match(appSource, /function\s+interestGroupBoardCard\s*\(/, "interest-group card renderer is missing");
assert.match(appSource, /function\s+interestGroupBoardPalette\s*\(/, "interest-group presentation palette is missing");
assert.match(appSource, /function\s+interestGroupVariants\s*\(/, "interest-group variant aggregation is missing");
assert.match(appSource, /selectedInterestGroupFlavor/, "interest-group flavor pages need their own route state");
assert.match(appSource, /function\s+renderInterestGroupFlavorBoardDetail\s*\(/, "interest-group flavor pages need a dedicated renderer");
assert.match(appSource, /function\s+interestGroupFlavorRoute\s*\(/, "interest-group flavor pages need stable routes");
assert.match(appSource, /interestGroupFlavorOptions\(group,\s*\[flavor\]\)/, "interest-group flavor pages must normalize variant traits before rendering cards");
assert.match(appSource, /function\s+interestGroupFlavorHeadingHtml\s*\(/, "flavor pages need a heading that links to their parent interest group");
assert.match(appSource, /function\s+interestGroupFlavorLinkRowsHtml\s*\(/, "parent interest-group pages need direct flavor link rows");
assert.match(appSource, /items\.map\(\(flavor\) => interestGroupFlavorLinkHtml\(group, flavor\)\)\.join\(t\("interestGroup\.flavorSeparator", " \/ "\)\)/, "condition and country flavor links must use the same slash separator as named flavors");
assert.match(appSource, /interest-group-board-shell interest-group-board-detail" style="\$\{escapeHtml\(interestGroupBoardColorStyle\(group\)\)\}"/, "interest-group detail color variables must wrap the title and flavor-link rows");
assert.match(appSource, /cleanDescriptionText\(entityText\(group, "description", ""\)\)/, "flavor pages must use the parent interest-group description instead of flavor availability text");
assert.match(appSource, /parts\[2\]\s*===\s*["']flavor["']/, "interest-group flavor routes must be parsed before the parent group route");
assert.match(appSource, /interestGroupCountryList\(flavor\.countries\)/, "interest-group flavor pages must link their applicable countries");
assert.match(appSource, /interestGroupBoardOrder/, "interest-group card order is missing");
for (const key of expectedKeys) {
  assert.match(appSource, new RegExp(key), `missing interest-group card key ${key}`);
}
assert.match(appSource, /routeView[\s\S]*interest-group/, "interest-group route is not recognized");
assert.match(appSource, /dataChunksForView[\s\S]*interest-group/, "interest-group route needs its data chunks");
assert.match(appSource, /if\s*\(view\s*===\s*["']interest-group["']\)\s*\{?\s*state\.selectedInterestGroup\s*=\s*["']["']/, "top navigation must clear the selected interest group");
assert.match(appSource, /location\.hash\s*=\s*["'`]\/interest-group\//, "interest-group cards must link to details");
assert.match(appSource, /display\?\.is_flavored/, "variant aggregation must exclude base names");
assert.match(appSource, /interestGroupTraitSlots/, "detail page needs ordered interest-group trait slots");
assert.match(appSource, /interestGroupTraitSlotDefinitions/, "trait slots need fixed approval-order definitions");
assert.match(appSource, /interestGroupFlavorSelectorHtml/, "detail page needs one flavor selector above the trait slots");
assert.match(appSource, /data-interest-group-flavor-select/, "flavor selection needs one explicit control");
assert.match(appSource, /bindInterestGroupFlavorSelector/, "flavor selection needs browser interaction binding");
assert.doesNotMatch(appSource, /data-interest-group-trait-choice/, "individual trait slots must not duplicate the flavor selector");
assert.match(appSource, /interestGroupPopulationAttractionHtml/, "detail page needs population-attraction rendering");
assert.match(appSource, /summary\.split\(\/；\|;\/\)/, "trait modifier summaries must break at semicolons");
assert.match(appSource, /pop_attraction/, "population-attraction data must reach the board renderer");
assert.match(appSource, /assets\/lucide\/icons\/arrow-left\.svg/, "detail return control must use the icon-library left arrow");
assert.match(appSource, /potential_flavors/, "detail page must include flavors available after the opening setup");
assert.match(appSource, /interestGroupCountryList/, "country tags need a reusable direct-list renderer");
assert.match(appSource, /interestGroup\.flavorSeparator/, "flavor names must use their own separator");
assert.match(appSource, /interest-group-selected-information/, "selected flavor needs to contain its related information");
assert.match(appSource, /interest-group-population-disclosure/, "population conditions need a disclosure list");
assert.match(appSource, /interestGroupTraitSignature/, "trait-only country flavors need their own aggregation path");
assert.match(appSource, /interestGroupIdeologySignature/, "ideology-only condition variants need their own aggregation path");
assert.match(appSource, /interestGroupConditionFlavorDefinition/, "descriptive condition-variant names need an explicit mapping");
assert.match(appSource, /interestGroupFlavorCategory/, "flavor selector options need explicit category grouping");
assert.match(appSource, /<optgroup label=/, "flavor selector needs visible option groups");
assert.match(appSource, /interestGroupDevoutReligion/, "devout flavors need religion-based ordering");
assert.match(appSource, /class="interest-group-country-list"/, "country lists must be shown directly");
assert.doesNotMatch(appSource, /interest-group-country-disclosure/, "country lists must not be collapsible");
assert.match(appSource, /orderValueByList\(tierOrder, leftCountry\.tier\)/, "country lists must be ordered by country tier");
assert.match(appSource, /localizedCompare\(entityText\(leftCountry\) \|\| left, entityText\(rightCountry\) \|\| right\)/, "country lists must be ordered alphabetically within their tier");
assert.match(zhUi, /"interestGroup\.namedVariants": "风味名称"/, "Chinese selector needs a flavored-name group");
assert.match(zhUi, /"interestGroup\.specialCountryVariants": "国家风味"/, "Chinese selector needs a country-flavor group");
assert.match(enUi, /"interestGroup\.namedVariants": "Flavored names"/, "English selector needs a flavored-name group");
assert.match(enUi, /"interestGroup\.specialCountryVariants": "Country flavors"/, "English selector needs a country-flavor group");
for (const label of [
  "军队（加勒比、加利福尼亚）",
  "军队（普拉塔/南安第斯/北安第斯/中美/墨西哥）",
  "地主（拉美西语）",
  "地主（布尔）",
  "地主（波兰）",
  "知识分子（立宪派）",
  "实业家（殖民）",
  "小市民（重商派）",
]) {
  assert.match(appSource, new RegExp(label.replace(/[()]/g, "\\$&")), `missing descriptive condition variant: ${label}`);
}
assert.match(appSource, /function\s+applyArmedForcesConditionFlavorGrouping\s*\(/, "armed-force condition variants need final-effect grouping");
assert.match(appSource, /function\s+isArmedForcesCaudilloCultureCountry\s*\(/, "armed-force caudillo grouping must be derived from culture and geographic-region data");
assert.match(appSource, /name:\s*["']interestGroup\.variant\.armedForces\.latinSpanish["'][\s\S]*?conditionVariant:\s*["']caudillo_cultures["']/, "the caudillismo country signature must feed the caudillo condition variant");
assert.match(appSource, /latinSpanish\.countries\.delete\(tag\)/, "the Caribbean and California flavor must exclude caudillo-culture countries");
assert.match(appSource, /caudilloCultures\.countries\.add\(tag\)/, "the caudillo-culture flavor must include its matching countries");
for (const religion of ["东方正统教会", "东正教", "天主教", "新教", "逊尼派", "什叶派", "伊巴德派", "犹太教", "佛教", "印度教", "儒教", "神道教", "泛灵论"]) {
  assert.match(appSource, new RegExp(religion), `missing devout religion grouping: ${religion}`);
}
assert.doesNotMatch(appSource, /interest-group-variant-section/, "flavor details must not be duplicated below the selector");
assert.doesNotMatch(appSource, /field\(t\("interestGroup\.standardColor"/, "unverified presentation colors must not be shown as standard-color data");
assert.doesNotMatch(appSource, /<h3>\$\{escapeHtml\(slot\.label\)\}<\/h3>/, "approval thresholds must not be repeated above trait cards");
assert.match(indexSource, /id="backToTopButton"/, "the shell needs a back-to-top button");
assert.match(appSource, /backToTopButton/, "back-to-top behavior needs a browser binding");
assert.match(styleSource, /body\[data-view="interest-group"\]/, "interest-group full-width layout is missing");
assert.match(styleSource, /\.interest-group-flavor-link-row\s*\{[\s\S]*border-inline-start:\s*3px solid var\(--interest-group-color\)/, "flavor link rows need a visible left frame");
assert.match(styleSource, /\.interest-group-flavor-link-row a\s*\{[\s\S]*text-decoration-line:\s*underline/, "flavor link rows must underline direct links");
assert.match(appSource, /if \(view === "interest-group"\) return \["ideology", "country", "culture", "region", "law"\]/, "interest-group pages must preload the localized law data required by ideology hover cards");
assert.match(appSource, /if \(view === "country"\) return \["country", "culture", "region", "ideology", "law"\]/, "country pages must preload laws needed by ideology hover cards");
assert.match(appSource, /translateMessage\(`religion:\$\{key\}\.name`, key\)/, "country tooltips must localize religion keys");
assert.match(appSource, /target\.dataset\.conceptKind === "ideology" \? 0 : CONCEPT_TOOLTIP_DELAY_MS/, "ideology tooltips must appear immediately on hover");
assert.match(styleSource, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/, "desktop cards need four columns");
assert.match(
  styleSource,
  /@media\s*\(max-width:\s*760px\)[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  "narrow screens need two columns",
);

for (const [key, palette] of Object.entries(expectedPalette)) {
  assert.match(appSource, new RegExp(`${key}:\\s*\\{\\s*standard:\\s*["']${palette.standard}["'],\\s*background:\\s*["']${palette.background}["'],\\s*text:\\s*["']${palette.text}["']`), `palette is missing ${key}`);
}
const cardStyle = styleSource.slice(
  styleSource.indexOf(".interest-group-board-card {"),
  styleSource.indexOf(".interest-group-board-identity {"),
);
assert.match(cardStyle, /--interest-group-background/, "interest-group cards need a dedicated background color");
assert.match(cardStyle, /border-radius:\s*0/, "interest-group cards must use square period-style frames");
assert.match(cardStyle, /background:\s*color-mix\(in srgb, var\(--interest-group-background\) 72%, var\(--surface\) 28%\)/, "interest-group card backgrounds must soften their recorded background colors");
assert.doesNotMatch(cardStyle, /linear-gradient|translateY\(/, "interest-group cards must not use modern gradient or lift effects");
assert.match(styleSource, /\.interest-group-detail-heading[\s\S]*background:\s*color-mix\(in srgb, var\(--interest-group-background\) 72%, var\(--surface\) 28%\)/, "detail heading must use the softened interest-group background");
assert.match(styleSource, /\.interest-group-trait-slot-list[\s\S]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/, "trait slots must show three side-by-side cards on desktop");
assert.match(styleSource, /\.interest-group-trait-slot\.is-unhappy/, "unhappy trait cards need their own red surface");
assert.match(styleSource, /\.interest-group-trait-slot\.is-happy/, "happy trait cards need their own green surface");
assert.match(styleSource, /\.interest-group-trait-slot\.is-loyal/, "loyal trait cards need their own gold surface");
assert.match(styleSource, /\.topbar[\s\S]*position:\s*sticky/, "the global top bar must remain visible while scrolling");
const flavorContextMetaStyle = styleSource.slice(
  styleSource.indexOf(".interest-group-flavor-context-meta {"),
  styleSource.indexOf(".interest-group-flavor-context-meta .interest-group-rule-details {"),
);
assert.doesNotMatch(flavorContextMetaStyle, /justify-content:\s*flex-end/, "matching rules must not be forced to the far right");
assert.match(styleSource, /\.interest-group-flavor-selector/, "selected flavor needs its own compact visual container");
assert.match(styleSource, /\.interest-group-country-list/, "country tags need direct-list styling");
assert.doesNotMatch(styleSource, /\.interest-group-country-disclosure/, "country tags must not retain collapsible styling");

const intelligentsia = siteData.interestGroups.find((group) => group.key === "ig_intelligentsia");
assert.ok((intelligentsia?.pop_attraction || []).some((entry) => entry.label_key === "POP_LITERACY" && entry.value_raw === "literacy_rate" && entry.multiplier_raw === "20"), "generated site data must keep intelligentsia literacy attraction");
const tradeUnions = siteData.interestGroups.find((group) => group.key === "ig_trade_unions");
assert.equal((tradeUnions?.pop_attraction || []).filter((entry) => entry.label_key === "POP_LABORERS").length, 2, "generated site data must keep both laborer branches");
assert.ok((tradeUnions?.pop_attraction || []).some((entry) => entry.label_key === "POP_LABORERS" && entry.value_raw === "50" && entry.is_otherwise), "generated site data must mark the alternate laborer branch");
const france = siteData.countries?.find((country) => country.tag === "FRA");
const frenchTradeUnions = france?.interestGroups?.find((group) => group.key === "ig_trade_unions");
assert.ok(frenchTradeUnions?.active_traits?.some((trait) => trait.key === "ig_trait_bourse_du_travail"), "French trade unions must retain their Bourse du Travail trait");
assert.ok(!frenchTradeUnions?.active_traits?.some((trait) => trait.key === "ig_trait_solidarity"), "French trade unions must not inherit the generic solidarity trait");
const devout = siteData.interestGroups.find((group) => group.key === "ig_devout");
assert.ok((devout?.potential_flavors || []).some((flavor) => flavor.key === "ig_shinto_monks"), "generated site data must include Shinto priesthood as a later flavor");
const armedForces = siteData.interestGroups.find((group) => group.key === "ig_armed_forces");
assert.ok((armedForces?.potential_flavors || []).some((flavor) => flavor.key === "ig_red_army"), "generated site data must include Red Army as a later flavor");

console.log("interest_group_board: ok");
