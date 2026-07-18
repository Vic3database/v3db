import fs from "node:fs";
import path from "node:path";
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const root = process.cwd();
const indexSource = readText("site/index.html");
const appSource = readSiteAppSource(root);
const stylesSource = readSiteStyleSource(root);
const todoSource = readText("todolist.md");
const homeFunction = functionSource("renderHomeBoard");
const homeNewsFunction = functionSource("renderHomeNewsHtml");
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
expect(!indexSource.includes('<strong>列表</strong>'), "site shell should not impose a generic list heading on every page");
expect(indexSource.includes('styles.css?v=20260719-home-category-cards4'), "homepage stylesheet should have a cache version for the category title bars");
expect(indexSource.includes('app/boards.js?v=20260719-home-category-cards1'), "homepage board script should have a cache version for independent category cards");
expect(indexSource.includes('id="homeGuideButton"'), "homepage welcome panel should include the site guide button");
expect(indexSource.includes('id="homeLinks"'), "homepage should define an external links panel outside navigation");
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
expect(homeFunction.includes("renderHomeNewsHtml") && homeNewsFunction.includes("home-news-panel"), "homepage should render the news panel");
expect(homeNewsFunction.includes("home-news-tabs"), "homepage news panel should render category tabs");
expect(homeNewsFunction.includes("查看更多 →"), "homepage news panel should provide a more link");
expect(homeFunction.includes('const categories = ["外交", "内政", "经济", "军事", "社会", "其他"]'), "homepage should define the six independent category cards");
expect(!homeFunction.includes("const categoryRows ="), "homepage should not merge categories into paired rows");
expect(homeFunction.includes('class="home-category-card"'), "homepage should render each category as an independent card");
expect(/\.home-category-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/.test(stylesSource), "homepage category cards should use a six-column grid");
expect(/\.home-category-card\s*\{[\s\S]*grid-column:\s*(?:1\s*\/\s*)?span\s*3/.test(stylesSource), "standard category cards should span three columns");
expect(/\.home-category-card\[data-category="经济"\]\s*\{[\s\S]*grid-column:\s*(?:1\s*\/\s*)?span\s*4/.test(stylesSource), "economy category card should span four columns");
expect(/\.home-category-card\[data-category="军事"\]\s*\{[\s\S]*grid-column:\s*(?:1\s*\/\s*)?span\s*2/.test(stylesSource), "military category card should span two columns");
expect(/\.home-category-card\s*\{[\s\S]*border:\s*1px\s+solid\s+rgba\(200,\s*164,\s*91,\s*0?\.3\)/.test(stylesSource), "category cards should use the elevated gold border");
expect(/\.home-category-card\s*\{[\s\S]*background:\s*rgba\(31,\s*33,\s*31,\s*0?\.46\)/.test(stylesSource), "category card bodies should remain gray");
expect(/\.home-category-card\s*\{[\s\S]*box-shadow:\s*var\(--shadow\)/.test(stylesSource), "category cards should use the elevated panel shadow");
expect(/\.home-category-heading\s*\{[\s\S]*margin:\s*-12px\s+-12px\s+12px[\s\S]*background:\s*linear-gradient\(180deg,\s*color-mix\(in\s+srgb,\s*var\(--panel\)\s+92%,\s*white\s+4%\),\s*var\(--panel\)\)[\s\S]*border-bottom:\s*1px\s+solid\s+rgba\(200,\s*164,\s*91,\s*0?\.28\)/.test(stylesSource), "category headings should use blue bars separated from the gray body by gold lines");
expect(/\.home-category-card\s+\.home-entry-grid\s*\{[^}]*gap:\s*36px/.test(stylesSource), "three-entry category cards should retain the historical spacing");
expect(/\.home-category-card\[data-category="经济"\]\s+\.home-entry-grid\s*\{[^}]*gap:\s*36px/.test(stylesSource), "economy category card should retain the historical spacing");
expect(/\.home-entry\s*\{[\s\S]*grid-template-columns:\s*46px\s+minmax\(0,\s*1fr\)/.test(stylesSource), "homepage entry cards should place icon left and text right");
expect(/\.home-entry\s*\{[\s\S]*background:\s*var\(--surface\)/.test(stylesSource), "homepage entry buttons should retain gray backgrounds");
expect(/\.home-entry-copy strong\s*\{[\s\S]*font-size:\s*var\(--text-base\)/.test(stylesSource), "homepage entry labels should use the larger base text size");
expect(/\.home-category-heading h2\s*\{[\s\S]*font-size:\s*var\(--text-lg\)/.test(stylesSource), "homepage category headings should use a larger text size");
expect(/body\[data-view="home"\]\s+\.results\s*\{[\s\S]*top:\s*285px[\s\S]*padding:\s*0[\s\S]*border:\s*0[\s\S]*background:\s*transparent/.test(stylesSource), "homepage category cards should begin below the complete welcome panel without a shared outer card");
expect(/\.home-links\s*\{/.test(stylesSource), "homepage should style the external links panel");
expect(/\.home-links\[hidden\]\s*\{[\s\S]*display:\s*none\s*!important/.test(stylesSource), "homepage links should stay hidden outside the homepage");
expect(/\.home-links a\s*\{[\s\S]*color:\s*var\(--ink\)[\s\S]*font-weight:\s*400/.test(stylesSource), "homepage links should use regular white text");
expect(/\.home-updated-at\s*\{[\s\S]*color:\s*var\(--ink\)[\s\S]*font-size:\s*var\(--text-sm\)[\s\S]*font-weight:\s*400/.test(stylesSource), "homepage update time should use normal unbolded white text");
expect(/body\[data-view="home"\]\s+\.result-head\s*\{[\s\S]*display:\s*none/.test(stylesSource), "homepage should hide the entry and sort controls");
expect(/body\[data-view="home"\]\s+\.results\s*\{[\s\S]*top:\s*285px/.test(stylesSource), "homepage navigation should sit below the independent welcome panel");
expect(/body\[data-view="home"\]\s+\.filters/.test(stylesSource), "homepage should hide the normal filter panel");
expect(/body\[data-view="home"\]\s+\.detail\s*\{[\s\S]*left:\s*auto[\s\S]*right:\s*12px/.test(stylesSource), "homepage right panel should not overlap the entry grid");
expect(todoSource.includes("整理首页游戏资讯内容与链接来源"), "todo list should record the news-content follow-up");

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
