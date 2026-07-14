import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const indexSource = readText("site/index.html");
const appSource = readText("site/app.js");
const stylesSource = readText("site/styles.css");
const todoSource = readText("todolist.md");
const homeFunction = functionSource("renderHomeBoard");
const failures = [];
const icons = [
  "waving_flag.png",
  "nationalism.png",
  "state.png",
  "companies.png",
  "democracy.png",
  "mass_communication.png",
  "icon_achievements_enabled.png",
  "academia.png",
  "grand_strategy_games_prestige.png",
  "manufacturies.png",
  "law_enforcement.png",
  "sovereign_empire.png",
  "event_default.png",
  "romanticism.png",
  "international_diplomacy.png",
  "event_portrait.png",
  "line_infantry.png",
  "dreadnought.png",
];
const categories = ["外交", "内政", "社会", "经济", "军事", "其他"];

expect(homeFunction.includes("const entries = ["), "homepage should define its entry data");
expect((homeFunction.match(/icon: "/g) || []).length === 18, "homepage should define all eighteen requested entries");
expect(homeFunction.includes('view: "country"'), "homepage should retain the country entry route");
expect(homeFunction.includes('view: "changelog"'), "homepage should link the changelog entry");
expect(homeFunction.includes('const { landRegions, seaAreas } = regionOverviewCounts();'), "homepage should obtain region counts before data chunks load");
expect(homeFunction.includes('`${landRegions} 个地区、${seaAreas} 片海域`'), "homepage should show separate land-region and sea-area counts");
expect(homeFunction.includes('dataCount("laws", laws)'), "homepage should show the indexed law count before data chunks load");
expect(appSource.includes('function regionOverviewCounts()'), "site should derive region counts from the data index");
expect(homeFunction.includes("home-entry-grid"), "homepage should render an entry grid");
expect(homeFunction.includes("home-category"), "homepage should render categorized entry sections");
expect((homeFunction.match(/category: "/g) || []).length === 18, "homepage should classify all eighteen requested entries");
for (const category of categories) {
  expect(homeFunction.includes(`category: "${category}"`), `homepage should include the ${category} category`);
}
expect(homeFunction.includes("外交条约与博弈"), "homepage should include diplomacy and play entries");
expect(homeFunction.includes("日志、事件与决议"), "homepage should include journal, event, and decision entries");
expect(homeFunction.includes("角色"), "homepage should include the character entry");
expect(homeFunction.includes("陆军") && homeFunction.includes("海军"), "homepage should include military entries");
expect(indexSource.includes('id="homeWelcome"'), "homepage should define a welcome panel outside the navigation list");
expect(indexSource.includes('<strong>列表</strong>'), "homepage panel heading should read 列表");
expect(indexSource.includes('id="homeGuideButton"'), "homepage welcome panel should include the site guide button");
expect(indexSource.includes('id="homeLinks"'), "homepage should define an external links panel outside navigation");
expect(!indexSource.includes("州地区"), "homepage shell should use 地区 terminology");
expect(indexSource.includes("home-copyright"), "welcome panel should render the copyright statement");
expect(!homeFunction.includes("home-intro"), "homepage navigation renderer should not place the welcome copy inside navigation");
expect(!homeFunction.includes("home-guide-button"), "homepage navigation renderer should not place the site guide inside navigation");
expect(!homeFunction.includes("home-link-list"), "homepage navigation renderer should not place external links inside navigation");
expect(indexSource.includes('href="https://vic3.paradoxwikis.com/Victoria_3_Wiki"'), "homepage should link the Victoria 3 Wiki");
expect(indexSource.includes('href="https://vic3.parawikis.com/wiki/%E9%A6%96%E9%A1%B5"'), "homepage should link Parawikis");
expect(indexSource.includes('href="https://forum.paradoxplaza.com/forum/forums/victoria-3.1095/"'), "homepage should link the official forum");
expect(indexSource.includes('href="https://space.bilibili.com/3546875974126422"'), "homepage should include the official Bilibili account link");
expect(homeFunction.includes("home-announcement"), "homepage should render an announcement panel");
expect(homeFunction.includes("home-updated-at"), "homepage announcement should render its update time");
expect(homeFunction.includes("home-news-placeholder"), "homepage should render a news placeholder");
expect(homeFunction.includes("const categories ="), "homepage should define independent category-card data");
expect(!homeFunction.includes("const categoryRows ="), "homepage should not group categories into paired rows");
expect(homeFunction.includes('class="home-category-card"'), "homepage should render independent category-card templates");
expect(/\.home-category-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/.test(stylesSource), "homepage category list should use a six-column grid");
expect(/\.home-category-card\s*\{[\s\S]*grid-column:\s*(?:1\s*\/\s*)?span\s*3/.test(stylesSource), "standard category cards should span three columns");
expect(/\.home-category-card\[data-category="经济"\]\s*\{[\s\S]*grid-column:\s*(?:1\s*\/\s*)?span\s*4/.test(stylesSource), "economy category card should span four columns");
expect(/\.home-category-card\[data-category="军事"\]\s*\{[\s\S]*grid-column:\s*(?:1\s*\/\s*)?span\s*2/.test(stylesSource), "military category card should span two columns");
expect(/\.home-category-card\s*\{[\s\S]*border:\s*1px\s+solid\s+rgba\(200,\s*164,\s*91,\s*0?\.2\)/.test(stylesSource), "standard category cards should use the requested border color");
expect(!/\.home-category-heading\s*\{[^}]*border-bottom\s*:/.test(stylesSource), "category headings should not have a divider line");
expect(/\.home-category-card\s*\{[^}]*padding:\s*12px/.test(stylesSource), "category buttons should keep distance from the card edges");
expect(/\.home-category-card\s+\.home-entry-grid\s*\{[^}]*gap:\s*36px/.test(stylesSource), "three-entry category button spacing should match adjacent-card spacing");
expect(/\.home-category-card\[data-category="经济"\]\s+\.home-entry-grid\s*\{[^}]*gap:\s*36px/.test(stylesSource), "economy button spacing should align 公司 with 法律 and 成就");
expect(/\.home-entry\s*\{[\s\S]*grid-template-columns:\s*46px\s+minmax\(0,\s*1fr\)/.test(stylesSource), "homepage entry cards should place icon left and text right");
expect(/\.home-entry-copy strong\s*\{[\s\S]*font-size:\s*var\(--text-base\)/.test(stylesSource), "homepage entry labels should use the larger base text size");
expect(/\.home-category-heading h2\s*\{[\s\S]*font-size:\s*var\(--text-lg\)/.test(stylesSource), "homepage category headings should use a larger text size");
expect(/\.home-links\s*\{/.test(stylesSource), "homepage should style the external links panel");
expect(/\.home-links\[hidden\]\s*\{\s*display:\s*none/.test(stylesSource), "homepage links should hide outside the home view");
expect(/\.home-links a\s*\{[\s\S]*color:\s*var\(--ink\)[\s\S]*font-weight:\s*400/.test(stylesSource), "homepage links should use regular white text");
expect(/\.home-updated-at\s*\{[\s\S]*color:\s*var\(--ink\)[\s\S]*font-size:\s*var\(--text-sm\)[\s\S]*font-weight:\s*400/.test(stylesSource), "homepage update time should use normal unbolded white text");
expect(/body\[data-view="home"\]\s+\.result-head\s*\{[\s\S]*display:\s*none/.test(stylesSource), "homepage should hide the entry and sort controls");
expect(/body\[data-view="home"\]\s+\.results\s*\{[\s\S]*top:\s*214px/.test(stylesSource), "homepage navigation should sit below the independent welcome panel");
expect(/body\[data-view="home"\]\s+\.results\s*\{[^}]*bottom:\s*auto[^}]*height:\s*fit-content/.test(stylesSource), "homepage navigation panel height should follow its category cards");
expect(/body\[data-view="home"\]\s+\.filters/.test(stylesSource), "homepage should hide the normal filter panel");
expect(/body\[data-view="home"\]\s+\.detail\s*\{[\s\S]*left:\s*auto[\s\S]*right:\s*12px/.test(stylesSource), "homepage right panel should not overlap the entry grid");
expect(todoSource.includes("整理首页游戏资讯内容与链接来源"), "todo list should record the news-content follow-up");
expect(!appSource.includes("州地区"), "site UI should use 地区 terminology");

for (const icon of icons) {
  expect(homeFunction.includes(`assets/home/${icon}`), `homepage should reference ${icon}`);
  expect(fs.existsSync(path.join(root, "site", "assets", "home", icon)), `homepage asset should exist: ${icon}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  homepage_layout: "ok",
  entries: 18,
  icons: icons.length,
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
