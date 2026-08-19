import fs from "node:fs";
import path from "node:path";
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const root = process.cwd();
const indexSource = readText("site/index.html");
const appSource = readSiteAppSource(root);
const stylesSource = readSiteStyleSource(root);
const homeFunction = functionSource("renderHomeBoard");
const homeNewsFunction = functionSource("renderHomeNewsHtml");
const failures = [];
const icons = [
  "waving_flag.png",
  "nationalism.png",
  "state.png",
  "companies.png",
  "democracy.png",
  "icon_achievements_enabled.png",
  "academia.png",
  "grand_strategy_games_prestige.png",
  "manufacturies.png",
  "law_enforcement.png",
];
const contentIcons = [
  "assets/event-icons/event_icons/event_default.webp",
  "assets/event-icons/event_icons/event_protest.webp",
  "assets/event-icons/event_icons/event_default_option.webp",
  "assets/home/icon_achievements_enabled.png",
];
const categories = ["domestic", "society", "economy", "technology", "game"];

expect(homeFunction.includes("const entries = ["), "homepage should define its entry data");
expect((homeFunction.match(/icon: "/g) || []).length === 14, "homepage should define the fourteen published entries");
for (const view of ["country", "law", "ideology", "interest-group", "culture", "region", "company", "building", "goods", "technology", "journal", "event", "decision", "achievement"]) {
  expect(homeFunction.includes(`view: "${view}"`), `homepage should retain the ${view} entry route`);
}
expect(homeFunction.includes("home-entry-grid"), "homepage should render an entry grid");
expect(homeFunction.includes("home-category"), "homepage should render categorized entry sections");
expect((homeFunction.match(/category: "/g) || []).length === 14, "homepage should classify all published entries");
for (const category of categories) {
  expect(homeFunction.includes(`category: "${category}"`), `homepage should include the ${category} category`);
}
expect(homeFunction.includes('label: "nav.domestic"'), "homepage should use the topbar domestic group label");
expect(homeFunction.includes('label: "nav.gameContent"'), "homepage should use the topbar game-content group label");
const topbarGameOrder = ["data-nav-view=\"journal\"", "data-nav-view=\"event\"", "data-nav-view=\"decision\"", "data-nav-view=\"achievement\""].map((needle) => indexSource.indexOf(needle));
expect(topbarGameOrder.every((index) => index >= 0) && topbarGameOrder.every((index, position) => position === 0 || index > topbarGameOrder[position - 1]), "topbar game-content entries should order journal, event, decision, achievement");
expect(!homeFunction.includes("pending: true"), "homepage should not render entries absent from the topbar");
expect(!homeFunction.includes('dataCount("countries", countries)'), "homepage entry cards should not display country counts");
expect(!homeFunction.includes('dataCount("ideologies", ideologies)'), "homepage entry cards should not display ideology counts");
expect(!homeFunction.includes('dataCount("cultures", cultures)'), "homepage entry cards should not display culture counts");
expect(!homeFunction.includes('dataCount("technologies", technologies)'), "homepage entry cards should not display technology counts");
expect(!homeFunction.includes('dataCount("companies", companies)'), "homepage entry cards should not display company counts");
expect(!homeFunction.includes('`${laws.length} 条法律`'), "homepage entry cards should not display law counts");
expect(!homeFunction.includes('`${landStateRegions.length} 个地域`'), "homepage entry cards should not display region counts");
expect(homeFunction.includes('view: "country"') && !homeFunction.includes('text: "nav.country"'), "homepage entry cards should omit the secondary count line");
expect(indexSource.includes('id="homeWelcome"'), "homepage should define a welcome panel outside the navigation list");
expect(indexSource.includes('id="vcHomeEntry"'), "homepage should include a Victorian Century entry");
expect(indexSource.includes('href="vc/index.html"'), "homepage VC entry should use a relative vc path");
expect(indexSource.includes('src="assets/home/victorian-century.webp"'), "homepage VC entry should use the Workshop thumbnail WebP");
expect(
  indexSource.indexOf('id="homeWelcome"') < indexSource.indexOf('id="vcHomeEntry"')
    && indexSource.indexOf('id="vcHomeEntry"') < indexSource.indexOf('class="results"'),
  "homepage should place the VC entry after the site introduction and before category navigation",
);
expect(/\.home-mod-database-entry\s*\{[\s\S]*display:\s*grid/.test(stylesSource), "homepage should style the VC entry as an independent card");
expect(!indexSource.includes('<strong>列表</strong>'), "site shell should not impose a generic list heading on every page");
expect(/styles\.css\?v=/.test(indexSource), "homepage stylesheet should have a cache version");
expect(/app\/boards\.js\?v=/.test(indexSource), "homepage board script should have a cache version");
expect(indexSource.includes('id="homeGuideButton"'), "homepage welcome panel should include the site guide button");
expect(indexSource.includes('id="homeLinks"'), "homepage should define an external links panel outside navigation");
expect(
  indexSource.indexOf('id="homeWelcome"') < indexSource.indexOf('class="results"')
    && indexSource.indexOf('class="results"') < indexSource.indexOf('id="homeLinks"'),
  "homepage left flow should order the welcome panel, navigation, and links from top to bottom",
);
expect(indexSource.includes("home-copyright"), "welcome panel should render the copyright statement");
expect(!homeFunction.includes("home-intro"), "homepage navigation renderer should not place the welcome copy inside navigation");
expect(!homeFunction.includes("home-guide-button"), "homepage navigation renderer should not place the site guide inside navigation");
expect(!homeFunction.includes("home-link-list"), "homepage navigation renderer should not place external links inside navigation");
expect(indexSource.includes('href="https://vic3.paradoxwikis.com/Victoria_3_Wiki"'), "homepage should link the Victoria 3 Wiki");
expect(indexSource.includes('href="https://vic3.parawikis.com/wiki/%E9%A6%96%E9%A1%B5"'), "homepage should link Parawikis");
expect(indexSource.includes('href="https://forum.paradoxplaza.com/forum/forums/victoria-3.1095/"'), "homepage should link the official forum");
expect(indexSource.includes('href="https://space.bilibili.com/3546875974126422"'), "homepage should include the official Bilibili account link");
expect(homeFunction.includes("home-announcement"), "homepage should render an announcement panel");
expect(homeFunction.includes("announcementItems.map(announcementItemHtml)"), "homepage announcement should render generated announcement items");
expect(!homeFunction.includes("home-updated-at"), "homepage announcement should not add a separate generated-time row");
expect(!homeFunction.includes("data.meta?.generated_at"), "homepage announcement dates should come from the announcement source");
expect(homeFunction.includes("renderHomeNewsHtml") && homeNewsFunction.includes("home-news-panel"), "homepage should render the news panel");
expect(homeNewsFunction.includes("home-news-tabs"), "homepage news panel should render category tabs");
expect(homeNewsFunction.includes('t("news.more")'), "homepage news panel should provide a localized more link");
expect(homeFunction.includes('const categories = ['), "homepage should define the five topbar category cards");
const gameEntryOrder = ["view: \"journal\"", "view: \"event\"", "view: \"decision\"", "view: \"achievement\""].map((needle) => homeFunction.indexOf(needle));
expect(gameEntryOrder.every((index) => index >= 0) && gameEntryOrder.every((index, position) => position === 0 || index > gameEntryOrder[position - 1]), "homepage game-content entries should order journal, event, decision, achievement");
for (const icon of contentIcons) expect(homeFunction.includes(`icon: "${icon}"`), `homepage should reference ${icon}`);
expect(!homeFunction.includes("const categoryRows ="), "homepage should not merge categories into paired rows");
expect(homeFunction.includes('class="home-category-card"'), "homepage should render each category as an independent card");
expect(!homeFunction.includes('categoryEntries.length'), "homepage category headings should not display redundant entry counts");
expect(/\.home-category-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)[\s\S]*align-items:\s*start/.test(stylesSource), "homepage category cards should use five topbar-aligned columns");
expect(/\.home-category-card\s*\{[\s\S]*grid-column:\s*auto[\s\S]*align-self:\s*start/.test(stylesSource), "each topbar category card should keep its natural height");
expect(/\.home-category-card\s*\{[\s\S]*border:\s*1px\s+solid\s+rgba\(200,\s*164,\s*91,\s*0?\.3\)/.test(stylesSource), "category cards should use the elevated gold border");
expect(/\.home-category-card\s*\{[\s\S]*background:\s*rgba\(31,\s*33,\s*31,\s*0?\.46\)/.test(stylesSource), "category card bodies should remain gray");
expect(/\.home-category-card\s*\{[\s\S]*box-shadow:\s*var\(--shadow\)/.test(stylesSource), "category cards should use the elevated panel shadow");
expect(/\.home-category-heading\s*\{[\s\S]*margin:\s*-12px\s+-12px\s+12px[\s\S]*background:\s*linear-gradient\(180deg,\s*color-mix\(in\s+srgb,\s*var\(--panel\)\s+92%,\s*white\s+4%\),\s*var\(--panel\)\)[\s\S]*border-bottom:\s*1px\s+solid\s+rgba\(200,\s*164,\s*91,\s*0?\.28\)/.test(stylesSource), "category headings should use blue bars separated from the gray body by gold lines");
expect(/\.home-category-card\s+\.home-entry-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*gap:\s*10px/.test(stylesSource), "each topbar category should stack its own entries");
expect(/\.home-entry\s*\{[\s\S]*grid-template-columns:\s*46px\s+minmax\(0,\s*1fr\)/.test(stylesSource), "homepage entry cards should place icon left and text right");
expect(/\.home-entry\s*\{[\s\S]*background:\s*var\(--surface\)/.test(stylesSource), "homepage entry buttons should retain gray backgrounds");
expect(/\.home-entry-copy strong\s*\{[\s\S]*font-size:\s*var\(--text-base\)/.test(stylesSource), "homepage entry labels should use the larger base text size");
expect(/\.home-category-heading h2\s*\{[\s\S]*font-size:\s*var\(--text-lg\)/.test(stylesSource), "homepage category headings should use a larger text size");
expect(/body\[data-view="home"\]\s+\.results\s*\{[\s\S]*position:\s*static[\s\S]*padding:\s*0[\s\S]*border:\s*0[\s\S]*background:\s*transparent/.test(stylesSource), "homepage category cards should remain outside a shared outer card");
expect(indexSource.includes('class="home-left-column"'), "homepage should group the welcome, navigation, and links into a left flow column");
expect(/\.home-left-column\s*\{[\s\S]*display:\s*contents/.test(stylesSource), "homepage left flow column should preserve non-home layouts");
expect(/body\[data-view="home"\]\s+\.home-left-column\s*\{[\s\S]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+auto/.test(stylesSource), "desktop homepage should size its left column by welcome, navigation, and links");
expect(/body\[data-view="home"\]\s+\.results\s*\{[\s\S]*position:\s*static[\s\S]*overflow:\s*auto/.test(stylesSource), "homepage navigation should scroll only when its natural middle row is constrained");
expect(!/body\[data-view="home"\]\s+\.results\s*\{[\s\S]*top:\s*285px/.test(stylesSource), "homepage navigation should not use a fixed top offset");
expect(!/body\[data-view="home"\]\s+\.results\s*\{[\s\S]*bottom:\s*300px/.test(stylesSource), "homepage navigation should not reserve a fixed link area");
expect(/\.home-links\s*\{/.test(stylesSource), "homepage should style the external links panel");
expect(/\.home-links\[hidden\]\s*\{[\s\S]*display:\s*none\s*!important/.test(stylesSource), "homepage links should stay hidden outside the homepage");
expect(/\.home-links a\s*\{[\s\S]*color:\s*var\(--ink\)[\s\S]*font-weight:\s*400/.test(stylesSource), "homepage links should use regular white text");
expect(/\.home-announcement-list\s*\{[\s\S]*max-height:\s*min\(48vh,\s*560px\)[\s\S]*overflow-y:\s*auto/.test(stylesSource), "homepage announcements should scroll within a bounded panel");
expect(/body\[data-view="home"\]\s+\.result-head\s*\{[\s\S]*display:\s*none/.test(stylesSource), "homepage should hide the entry and sort controls");
expect(/body\[data-view="home"\]\s+\.filters/.test(stylesSource), "homepage should hide the normal filter panel");
expect(/body\[data-view="home"\]\s+\.detail\s*\{[\s\S]*left:\s*auto[\s\S]*right:\s*12px/.test(stylesSource), "homepage right panel should not overlap the entry grid");

for (const icon of icons) {
  expect(homeFunction.includes(`assets/home/${icon}`), `homepage should reference ${icon}`);
  expect(fs.existsSync(path.join(root, "site", "assets", "home", icon)), `homepage asset should exist: ${icon}`);
}
for (const icon of ["victorian-century.webp", ...contentIcons.map((value) => value.replace(/^assets\//, ""))]) {
  const assetPath = icon.includes("/") ? path.join(root, "site", "assets", icon) : path.join(root, "site", "assets", "home", icon);
  expect(fs.existsSync(assetPath), `homepage asset should exist: ${icon}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  homepage_layout: "ok",
  entries: 14,
  icons: icons.length + contentIcons.length,
}, null, 2));

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

function expect(condition, message) {
  if (!condition) failures.push(message);
}
