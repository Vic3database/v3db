# 建筑与商品板块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Vicdata 主站 1.13.9 简体中文界面新增相互独立的建筑与商品图片墙，并提供建筑生产方式组合、资源地图跳转和商品生产建筑关系。

**Architecture:** 提取脚本把建筑、建筑组、生产方式组、生产方式、商品和名贵商品写入数据库；网站构建拆为 `building` 与 `goods` 两个延迟数据块。前端新增 `economy.js` 与 `economy.css`，两个板块共享图片墙和详情框架，但各自拥有路由、搜索状态和详情渲染。建筑详情按组横排生产方式，保留条件修正并计算笛卡尔积组合；商品详情只消费已经反向关联好的生产建筑，不读取生产方式明细。

**Tech Stack:** Node.js ESM、现有 Clausewitz 文本解析器、Python Pillow、原生浏览器 JavaScript/CSS、Chrome DevTools Protocol 回归脚本。

---

## 文件职责

| 文件 | 改动职责 |
| --- | --- |
| `scripts/extract_vic3_countries.mjs` | 读取经济定义，建立生产关系、条件修正和资源地图资格，写入数据库。 |
| `scripts/check_economy_database.mjs` | 校验 1.13.9 经济数据库完整性和油井组合样例。 |
| `scripts/build_economy_assets.mjs` | 将数据库声明的 DDS 图标转换为网站 PNG 资源。 |
| `scripts/check_economy_assets.mjs` | 校验图标来源、输出文件和数据库路径一一对应。 |
| `scripts/build_wiki.mjs` | 将经济数据库文件写为 `data-buildings.js` 与 `data-goods.js`。 |
| `scripts/check_data_chunking.mjs` | 校验两个新数据块的索引、字段和文件。 |
| `scripts/check_publish_bundle.mjs` | 将数据记录中的经济图标纳入发布文件集合。 |
| `site/app/runtime.js` | 增加经济资料数组、索引和页面状态。 |
| `site/app/data.js` | 按路由延迟加载经济数据块，重建索引和语义标签索引。 |
| `site/app/ui.js` | 解析建筑、商品和资源地图深链接，控制导航可见性与渲染分派。 |
| `site/app/economy.js` | 渲染两个图片墙、详情、生产方式、组合结果和跨板块跳转。 |
| `site/app/map.js` | 复用现有资源分布模式，使深链接的筛选状态直接驱动地图。 |
| `site/app/achievements.js` | 不修改成就交互；作为经济图片墙结构的对照实现。 |
| `site/styles/economy.css` | 经济图片墙、详情栏、横排生产方式和组合表的响应式样式。 |
| `site/styles.css`、`scripts/site_frontend_sources.mjs`、`site/index.html` | 引入新样式与脚本，添加仅在数据块存在时显示的入口。 |
| `scripts/check_economy_board_contract.mjs` | 静态校验路由、页面结构、组合函数、商品边界和样式约束。 |
| `scripts/check_economy_boards_browser.mjs` | 在实际浏览器中校验图片墙、详情、组合与资源地图跳转。 |
| `README.md` | 写入提取、图标构建和校验命令。 |

### Task 1: 经济数据库与生产关系

**Files:**

- Modify: `scripts/extract_vic3_countries.mjs: main 数据读取、writeDatabase、解析辅助函数`
- Create: `scripts/check_economy_database.mjs`
- Modify: `database/vic3_1.13.9/index.json`、`database/vic3_1.13.9/*.json`（由构建命令生成，不手工编辑）

- [ ] **Step 1: 编写数据库失败校验。**

```js
// scripts/check_economy_database.mjs
assert.equal(buildings.length, 102, "1.13.9 picture wall must contain 102 icon-bearing buildings");
assert.equal(excludedGraphicalBuildings.length, 14, "only fourteen iconless decorative buildings may be excluded");
assert.equal(goods.length, 53, "all 53 base goods must be published");
assert.equal(prestigeGoods.length, 72, "all 72 prestige goods must be published");

const oilRig = byKey(buildings, "building_oil_rig");
assert.deepEqual(
  oilRig.production_method_groups.map(({ key, production_methods }) => [key, production_methods.length]),
  [["pmg_base_building_oil_rig", 2], ["pmg_transportation_building_oil_rig", 3]],
  "oil rig must retain its two-by-three production-method choices",
);
assert.equal(oilRig.combination_count, 6, "oil rig must publish all six combinations");
assert.equal(oilRig.resource_map_available, true, "oil rig must open the resource distribution map");
assert(byKey(goods, "oil").producing_buildings.some(({ key }) => key === "building_oil_rig"), "oil must link to oil rig");
for (const key of ["services", "transportation", "electricity", "gold"]) assert(byKey(goods, key), `${key} must remain a good`);
```

- [ ] **Step 2: 运行校验，确认现有数据库尚未含有经济资料。**

Run: `node scripts/check_economy_database.mjs`

Expected: FAIL，报出 `buildings.json` 或经济文件索引不存在。

- [ ] **Step 3: 在提取脚本中建立单一的经济资料结构。**

在 `main()` 中于 `stateRegionRows` 和 `technologies` 已生成之后调用 `loadEconomyData`，把结果传入 `writeDatabase`。资源资格直接以州地区现有的 `arable_resources`、`capped_resources` 与 `discoverable_resources` 建立集合；商品生产建筑关系从所有生产方式的正向 `goods_output_*` 修正反向汇总，去重后只写建筑短引用。

```js
const economy = loadEconomyData({
  buildingDirs: contentPath("common", "buildings"),
  buildingGroupDirs: contentPath("common", "building_groups"),
  productionMethodGroupDirs: contentPath("common", "production_method_groups"),
  productionMethodDirs: contentPath("common", "production_methods"),
  goodsDirs: contentPath("common", "goods"),
  prestigeGoodsDirs: contentPath("common", "prestige_goods"),
  stateRegionRows,
  loc,
});

writeDatabase(databaseDir, {
  version,
  datasetName,
  gamePath,
  gameDir,
  modPath,
  modContentRoot,
  loc,
  countryRows,
  cultures,
  cultureTraits,
  cultureTraitGroups,
  stateRegionRows,
  strategicRegionRows,
  companies,
  companyCharterTypes,
  interestGroups,
  interestGroupTraits,
  ideologies,
  lawGroups,
  laws,
  technologies,
  technologyEras,
  achievements,
  geographicRegions,
  relatedCountriesByCulture,
  definitions,
  dynamicNameVariants,
  dynamicMapColorRules,
  cultureRows,
  cultureTraitRows,
  cultureTraitGroupRows,
  formableRules: formables,
  formables: formationRows,
  releasables: releaseRows,
  economy,
});
```

`loadEconomyData` 返回如下完整结构，所有键名在网站数据块中保持一致：

```js
{
  buildings: [{
    key, name_zh, name_fallback_zh, description_zh, icon: { source, site_path },
    building_group: { key, name_zh, category_key, category_name_zh, order },
    city_type, required_construction, unlocking_technologies,
    resource_map_available,
    production_method_group_keys,
    combination_count, source_file,
  }],
  building_groups: [{ key, name_zh, category_key, category_name_zh, order }],
  production_method_groups: [{ key, name_zh, icon: { source, site_path }, production_method_keys }],
  production_methods: [{
    key, name_zh, icon: { source, site_path }, unlocking_technologies,
    availability_conditions: [{ kind, summary_zh, raw, references }],
    effects: [{ scope, scaling, key, value, condition }], source_file,
  }],
  goods: [{ key, name_zh, description_zh, category, price, is_local, icon: { source, site_path }, prestige_good_keys, producing_buildings: [{ key, name_zh, icon_path }] }],
  prestige_goods: [{ key, name_zh, base_good_key, description_zh, icon: { source, site_path } }],
  excluded_graphical_buildings: [{ key, building_group, source_file, reason: "missing_icon" }],
}
```

生产方式解析只接受 `building_modifiers`、`state_modifiers`、`country_modifiers` 中的数值修正。递归读取 `workforce_scaled` 与 `level_scaled`，写入 `scaling`；遇到 `if` 或 `else_if` 时，将该分支的 `limit` 通过现有 `conditionSummaryObject` 写入 `condition`。`unlocking_technologies`、`disallowing_laws`、`required_input_goods` 与 `replacement_if_valid` 也作为生产方式可用条件写入，保留中文引用和原始脚本。无条件修正的 `condition` 固定为 `null`。

```js
function economyEffect({ scope, scaling = "", key, value, conditionValue, loc }) {
  const numeric = toNumberOrNull(value);
  if (numeric === null) return null;
  return {
    scope,
    scaling,
    key,
    value: numeric,
    condition: conditionValue ? conditionSummaryObject(conditionValue, loc) : null,
  };
}
```

排除条件必须只匹配 `building_group === "bg_monuments_hidden" && !firstScalar(node, "icon")`。`bg_monuments_hidden` 中仍带图标的 4 项与其他 98 项共同进入 `buildings`，因此图片墙总数是 102。`building_machu_picchu` 虽然有图标，但中文字段解析后为开发注释；提取时写入 `name_fallback_zh: "马丘比丘"`，页面显示使用 `name_zh || name_fallback_zh || key`。除这一个已核对的例外外，任何图片墙建筑解析到空名称或开发注释时都令 `check_economy_database.mjs` 失败。

- [ ] **Step 4: 扩展数据库文件索引与说明。**

在 `writeDatabase` 的 `files`、`counts`、JSON 写入和自动 README 中加入以下七个文件，避免由单一大文件隐式传递资料：

```js
files: {
  countries: "countries.json",
  cultures: "cultures.json",
  culture_traits: "culture_traits.json",
  culture_trait_groups: "culture_trait_groups.json",
  state_regions: "state_regions.json",
  strategic_regions: "strategic_regions.json",
  geographic_regions: "geographic_regions.json",
  companies: "companies.json",
  company_charter_types: "company_charter_types.json",
  interest_groups: "interest_groups.json",
  interest_group_traits: "interest_group_traits.json",
  ideologies: "ideologies.json",
  law_groups: "law_groups.json",
  laws: "laws.json",
  technologies: "technologies.json",
  technology_eras: "technology_eras.json",
  achievements: "achievements.json",
  dynamic_country_name_variants: "dynamic_country_name_variants.json",
  dynamic_country_map_color_rules: "dynamic_country_map_color_rules.json",
  formable_countries: "formable_countries.json",
  releasable_countries: "releasable_countries.json",
  buildings: "buildings.json",
  building_groups: "building_groups.json",
  production_method_groups: "production_method_groups.json",
  production_methods: "production_methods.json",
  goods: "goods.json",
  prestige_goods: "prestige_goods.json",
  excluded_graphical_buildings: "excluded_graphical_buildings.json",
}
```

- [ ] **Step 5: 重新提取并确认数据库校验通过。**

Run:

```powershell
node scripts/extract_vic3_countries.mjs --game-path "D:\SteamLibrary\steamapps\common\Victoria 3" --version 1.13.9 --out output\vic3_1.13.9 --database database\vic3_1.13.9
node scripts/check_economy_database.mjs
```

Expected: `economy_database: "ok"`，油井组合数为 6，商品数为 53，名贵商品数为 72。

- [ ] **Step 6: 提交数据库提取实现。**

```powershell
git add scripts/extract_vic3_countries.mjs scripts/check_economy_database.mjs
git commit -m "feat: extract buildings and goods data"
```

### Task 2: 图标同步、数据块和发布完整性

**Files:**

- Create: `scripts/build_economy_assets.mjs`
- Create: `scripts/check_economy_assets.mjs`
- Modify: `scripts/build_wiki.mjs: wikiData、dataChunks、dataChunkFileNames、loadSiteData、deriveSiteData`
- Modify: `scripts/check_data_chunking.mjs`
- Modify: `scripts/check_publish_bundle.mjs: dataAssetReferences`
- Modify: `README.md`
- Modify: `site/versions/1.13.9/data-index.js`、`site/versions/1.13.9/data-buildings.js`、`site/versions/1.13.9/data-goods.js`（由构建命令生成，不手工编辑）
- Create or modify: `site/assets/buildings/*.png`、`site/assets/goods/*.png`、`site/assets/prestige-goods/*.png`、`site/assets/production-methods/*.png`（由构建命令生成）

- [ ] **Step 1: 写数据块失败校验。**

将 `check_data_chunking.mjs` 的期望对象扩展为两个精确字段集合：

```js
const expectedChunks = {
  country: ["countries", "dynamicCountryNameVariants", "dynamicCountryMapColorRules", "formables", "releasables"],
  culture: ["cultures", "cultureTraits", "cultureTraitGroups"],
  region: ["stateRegions", "strategicRegions", "geographicRegions"],
  company: ["companies", "companyCharterTypes"],
  ideology: ["interestGroups", "interestGroupTraits", "ideologies"],
  law: ["laws", "lawGroups"],
  technology: ["technologies", "technologyEras"],
  achievement: ["achievements"],
  building: ["buildings", "buildingGroups", "productionMethodGroups", "productionMethods"],
  goods: ["goods", "prestigeGoods"],
};
```

并在 `scripts/check_economy_assets.mjs` 中读取 `database/vic3_1.13.9/index.json`，校验每个 `icon.source` 位于其中声明的 `source_paths.game_data` 下、每个 `icon.site_path` 位于 `site/assets/` 下且是 PNG；无图标的 14 项必须仅出现于 `excluded_graphical_buildings.json`。

- [ ] **Step 2: 运行校验，确认生成文件尚未存在。**

Run:

```powershell
node scripts/check_data_chunking.mjs
node scripts/check_economy_assets.mjs
```

Expected: FAIL，报出缺少 `building`、`goods` 数据块与生产方式图标目录。

- [ ] **Step 3: 新建图标转换脚本。**

`build_economy_assets.mjs` 仿照 `build_achievement_assets.mjs`，只以数据库内声明的路径构造清单，通过 Pillow 将 DDS 转为 PNG。目标文件名使用源文件名去掉 `.dds` 后加 `.png`，路径直接来自记录的 `icon.site_path`。脚本不能扫描并删除现有图标目录，避免影响其他板块资源。

```js
const entries = collectEconomyIcons({ buildings, goods, prestigeGoods, productionMethods })
  .map(({ source, site_path }) => ({
    source: path.join(gameData, ...source.split("/")),
    destination: path.join(root, "site", ...site_path.split("/")),
  }));

const pythonProgram = [
  "import json, sys",
  "from pathlib import Path",
  "from PIL import Image",
  "for entry in json.loads(Path(sys.argv[1]).read_text(encoding='utf-8')):",
  "    destination = Path(entry['destination'])",
  "    destination.parent.mkdir(parents=True, exist_ok=True)",
  "    with Image.open(entry['source']) as image:",
  "        image.save(destination, 'PNG')",
].join("\\n");
```

目标目录固定为 `assets/buildings/`、`assets/goods/`、`assets/prestige-goods/` 与 `assets/production-methods/`。同一资源被多条记录引用时按 `source` 与 `site_path` 去重；同名输出指向不同源路径时立即抛错。

- [ ] **Step 4: 在网站构建中输出两个独立数据块。**

`build_wiki.mjs` 读取七个新数据库文件，并在派生数据后转换为前端字段命名。建筑数据块包含生产方式明细；商品数据块只保留基础商品、名贵商品与建筑短引用。

```js
const wikiData = {
  meta: data.meta,
  countries: data.countries,
  cultures: data.cultures,
  cultureTraits: data.cultureTraits,
  cultureTraitGroups: data.cultureTraitGroups,
  stateRegions: data.stateRegions,
  strategicRegions: data.strategicRegions,
  geographicRegions: data.geographicRegions,
  companies: data.companies,
  companyCharterTypes: data.companyCharterTypes,
  interestGroups: data.interestGroups,
  interestGroupTraits: data.interestGroupTraits,
  ideologies: data.ideologies,
  laws: data.laws,
  lawGroups: data.lawGroups,
  technologies: data.technologies,
  technologyEras: data.technologyEras,
  achievements: data.achievements,
  dynamicCountryNameVariants: data.dynamicCountryNameVariants,
  dynamicCountryMapColorRules: data.dynamicCountryMapColorRules,
  formables: data.formables,
  releasables: data.releasables,
  buildings: data.buildings,
  buildingGroups: data.buildingGroups,
  productionMethodGroups: data.productionMethodGroups,
  productionMethods: data.productionMethods,
  goods: data.goods,
  prestigeGoods: data.prestigeGoods,
};

const dataChunks = {
  country: ["countries", "dynamicCountryNameVariants", "dynamicCountryMapColorRules", "formables", "releasables"],
  culture: ["cultures", "cultureTraits", "cultureTraitGroups"],
  region: ["stateRegions", "strategicRegions", "geographicRegions"],
  company: ["companies", "companyCharterTypes"],
  ideology: ["interestGroups", "interestGroupTraits", "ideologies"],
  law: ["laws", "lawGroups"],
  technology: ["technologies", "technologyEras"],
  achievement: ["achievements"],
  building: ["buildings", "buildingGroups", "productionMethodGroups", "productionMethods"],
  goods: ["goods", "prestigeGoods"],
};

const dataChunkFileNames = {
  country: "data-countries.js",
  culture: "data-cultures.js",
  region: "data-regions.js",
  company: "data-companies.js",
  ideology: "data-ideologies.js",
  law: "data-laws.js",
  technology: "data-technologies.js",
  achievement: "data-achievements.js",
  building: "data-buildings.js",
  goods: "data-goods.js",
};
```

`loadSiteData` 缺少新文件时返回空数组，保持旧历史版本与 Victorian Century 数据库可构建；主站 1.13.9 的生成后文件必须含这两个块。

- [ ] **Step 5: 将数据驱动图标加入发布校验与操作说明。**

在 `check_publish_bundle.mjs` 的 `dataAssetReferences` 增加以下引用规则，使发布检查在数据块中逐项追踪资源文件：

```js
for (const building of data.buildings || []) out.push(building.icon?.site_path);
for (const good of data.goods || []) out.push(good.icon?.site_path);
for (const prestigeGood of data.prestigeGoods || []) out.push(prestigeGood.icon?.site_path);
for (const method of data.productionMethods || []) out.push(method.icon?.site_path);
```

在 `README.md` 的成就构建段后增加建筑和商品流程：先运行提取命令，再执行 `node scripts/build_economy_assets.mjs` 与 `node scripts/build_wiki.mjs --database database\vic3_1.13.9 --out site\versions\1.13.9`，最后执行两个经济校验和发布校验。

- [ ] **Step 6: 生成资源与数据块，再运行通过校验。**

Run:

```powershell
node scripts/build_economy_assets.mjs
node scripts/build_wiki.mjs --database database\vic3_1.13.9 --out site\versions\1.13.9
node scripts/check_economy_assets.mjs
node scripts/check_data_chunking.mjs
node scripts/check_publish_bundle.mjs
```

Expected: 三项校验输出 `ok`，`data-buildings.js` 与 `data-goods.js` 均列入 `data-index.js`。

- [ ] **Step 7: 提交构建与资源结果。**

```powershell
git add scripts/build_economy_assets.mjs scripts/check_economy_assets.mjs scripts/build_wiki.mjs scripts/check_data_chunking.mjs scripts/check_publish_bundle.mjs README.md site/versions/1.13.9 site/assets/buildings site/assets/goods site/assets/prestige-goods site/assets/production-methods
git commit -m "feat: publish economy data chunks and icons"
```

### Task 3: 两个独立板块的运行时、路由与页面骨架

**Files:**

- Modify: `site/index.html: 顶栏、窄屏选择器、脚本标签版本号`
- Modify: `site/app/runtime.js: 经济数组、Map 索引、state、viewLabels`
- Modify: `site/app/data.js: dataChunksForView、routeView、applyLoadedDataset、buildSemanticTagIndexes、resetDatasetState`
- Modify: `site/app/ui.js: applyHash、updatePageChrome、render、detailRouteKey`
- Create: `site/app/economy.js`
- Modify: `site/app/map.js: 资源深链接状态同步`
- Create: `site/styles/economy.css`
- Modify: `site/styles.css`
- Modify: `scripts/site_frontend_sources.mjs`
- Create: `scripts/check_economy_board_contract.mjs`

- [ ] **Step 1: 写页面骨架失败校验。**

`check_economy_board_contract.mjs` 必须从实际的 1.13.9 数据块、`site/index.html`、合并前端源码和合并样式读取内容，并先写入以下约束：

```js
assert.match(index, /data-nav-view="building"[\s\S]*?factory\.svg/, "building navigation must use factory icon");
assert.match(index, /data-nav-view="goods"[\s\S]*?package\.svg/, "goods navigation must use package icon");
assert.match(app, /if \(view === "building"\) return \["building"\]/, "building route must load only building chunk");
assert.match(app, /if \(view === "goods"\) return \["goods"\]/, "goods route must load only goods chunk");
assert.match(app, /function renderBuildingBoard\(/, "building board renderer must exist");
assert.match(app, /function renderGoodsBoard\(/, "goods board renderer must exist");
assert.match(styles, /body\[data-view="building"\] \.map-panel,[\s\S]*?display: none/, "building board must hide map and filters");
assert.match(styles, /body\[data-view="goods"\] \.map-panel,[\s\S]*?display: none/, "goods board must hide map and filters");
```

- [ ] **Step 2: 运行静态校验，确认页面入口尚未实现。**

Run: `node scripts/check_economy_board_contract.mjs`

Expected: FAIL，报出缺少 `data-nav-view="building"`。

- [ ] **Step 3: 扩展运行时资料和延迟加载。**

在 `runtime.js` 新增独立数组和索引，不复用已有的 `buildingByKey`、`goodsByKey`，后两者继续服务地区和公司中的语义提示。

```js
let buildings = [];
let buildingGroups = [];
let productionMethodGroups = [];
let productionMethods = [];
let goods = [];
let prestigeGoods = [];
let economyBuildingByKey = new Map();
let productionMethodGroupByKey = new Map();
let productionMethodByKey = new Map();
let goodByKey = new Map();

Object.assign(state, {
  selectedBuilding: "",
  selectedGood: "",
  buildingSearch: "",
  goodsSearch: "",
  buildingWallScrollTop: 0,
  goodsWallScrollTop: 0,
  selectedProductionMethods: {},
});
```

在 `data.js` 增加 `building` 与 `goods` 的路由映射；`applyLoadedDataset` 必须把新数组赋值并建立两个新 Map，再将建筑和基础商品追加进语义索引。`resetDatasetState` 清空两个选中项、搜索条件、滚动位置和生产方式选择，防止切换数据版本时沿用旧键。

```js
if (view === "building") return ["building"];
if (view === "goods") return ["goods"];

if (["country", "culture", "region", "company", "ideology", "law", "technology", "achievement", "building", "goods"].includes(segment)) return segment;
```

- [ ] **Step 4: 新建经济页面渲染基础与导航入口。**

在 `economy.js` 声明共享的图片墙工具函数，只接受板块定义对象，避免将建筑和商品的详情逻辑混写：

```js
const economyBoardDefinitions = {
  building: { route: "building", searchState: "buildingSearch", selectedState: "selectedBuilding", cardAttribute: "data-building-key" },
  goods: { route: "goods", searchState: "goodsSearch", selectedState: "selectedGood", cardAttribute: "data-good-key" },
};

function economyBoardAvailable(kind) {
  return Boolean(dataIndex?.chunks?.[kind]);
}

function renderEconomyToolbar({ kind, total, visible, label, query }) {
  const inputId = `${kind}SearchInput`;
  return `<header class="economy-toolbar"><form data-economy-search-form="${kind}"><label for="${inputId}">搜索${label}</label><div class="economy-search-controls"><input id="${inputId}" type="search" autocomplete="off" value="${escapeHtml(query)}" data-economy-search="${kind}"><button type="submit" data-economy-search-submit="${kind}">搜索</button></div></form><strong>${visible} / ${total}</strong></header>`;
}

function bindEconomySearch(kind, submit) {
  const form = els.countryList.querySelector(`[data-economy-search-form="${kind}"]`);
  const input = els.countryList.querySelector(`[data-economy-search="${kind}"]`);
  form?.addEventListener("submit", (event) => { event.preventDefault(); submit(input); });
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) { event.preventDefault(); submit(input); }
  });
}
```

在 `index.html` 的顶栏和 `#viewSelect` 中加入 `building` 与 `goods`。图标分别使用现有的 `assets/lucide/icons/factory.svg` 与 `assets/lucide/icons/package.svg`。脚本顺序固定为 `components.js` 之后、`achievements.js` 之前；`site_frontend_sources.mjs` 采用相同顺序，`styles.css` 与 `styleSections` 都在 `achievements.css` 之后引入 `economy.css`。

在 `ui.js` 中对没有数据块的版本隐藏两个入口并拒绝深链接：

```js
if (parts[0] === "building" && !economyBoardAvailable("building")) { changeBoard("home", "home"); return; }
if (parts[0] === "goods" && !economyBoardAvailable("goods")) { changeBoard("home", "home"); return; }
```

有效路由为 `#/building`、`#/building/<key>`、`#/goods` 和 `#/goods/<key>`；`render()` 把两个视图交给对应渲染函数，并把它们加入 `boardManagesDetail`。`detailRouteKey()` 同时接受两个深链接，确保窄屏详情状态正确。

- [ ] **Step 5: 编写基础响应式样式。**

`economy.css` 使用成就板块相同的全屏布局分离方式，但保持独立类名。完整墙面采用 12 列，打开详情后桌面端为 10 列；窄屏上详情替代墙面。所有卡片图像指定懒加载并维持正方形显示框。

```css
body[data-view="building"] .map-panel,
body[data-view="building"] .filters,
body[data-view="goods"] .map-panel,
body[data-view="goods"] .filters { display: none; }

.economy-wall-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 10px; }
body.detail-page[data-view="building"] .economy-wall-grid,
body.detail-page[data-view="goods"] .economy-wall-grid { grid-template-columns: repeat(10, minmax(0, 1fr)); }
```

- [ ] **Step 6: 运行静态校验，确认板块骨架通过。**

Run: `node scripts/check_economy_board_contract.mjs`

Expected: 基础入口、路由、数据块和隐藏地图断言通过；生产方式和商品细节断言仍未加入。

- [ ] **Step 7: 提交板块基础。**

```powershell
git add site/index.html site/styles.css site/styles/economy.css site/app/runtime.js site/app/data.js site/app/ui.js site/app/economy.js site/app/map.js scripts/site_frontend_sources.mjs scripts/check_economy_board_contract.mjs
git commit -m "feat: add economy board routes and wall shell"
```

### Task 4: 建筑图片墙、生产方式与资源地图深链接

**Files:**

- Modify: `site/app/economy.js: 建筑分组、详情、选择、组合函数、资源地图按钮`
- Modify: `site/app/ui.js: #/region/resource/<building-key> 路由解析`
- Modify: `site/app/map.js: 资源筛选地图同步`
- Modify: `site/styles/economy.css: 建筑详情、生产方式横排、组合结果`
- Modify: `scripts/check_economy_board_contract.mjs`
- Create: `scripts/check_economy_boards_browser.mjs`

- [ ] **Step 1: 添加建筑行为失败断言。**

在静态契约加入以下内容，并新建浏览器脚本中的油井场景：

```js
assert.match(app, /function renderBuildingBoard\(/, "building wall must render by building group");
assert.match(app, /data-production-method-key/, "production-method icons must be clickable");
assert.match(app, /function cartesianProduct\(/, "all production-method combinations must be enumerated");
assert.match(app, /data-production-combination/, "each computed combination must have a stable DOM marker");
assert.match(app, /replaceHash\(`\/region\/resource\/\$\{encodeURIComponent\(building\.key\)\}`\)/, "resource button must use region deep link");
```

浏览器脚本先写入以下检查：

```js
await page.goto(`${baseUrl}#/building/building_oil_rig`);
await page.waitFor(() => document.querySelectorAll("[data-production-method-group]").length === 2);
assert.equal(await page.evaluate(() => document.querySelectorAll("[data-production-combination]").length), 6);
await page.evaluate(() => document.querySelector("[data-resource-map-building='building_oil_rig']").click());
await page.waitFor(() => location.hash === "#/region/resource/building_oil_rig");
```

- [ ] **Step 2: 运行静态与浏览器校验，确认失败点。**

Run:

```powershell
node scripts/check_economy_board_contract.mjs
node scripts/serve_site.mjs site 8876
node scripts/check_economy_boards_browser.mjs http://127.0.0.1:8876/index.html
```

Expected: 静态校验报出缺少组合函数；浏览器校验报出缺少生产方式组。验证时让站点服务保持运行，浏览器检查结束后再停止该服务。

- [ ] **Step 3: 实现按建筑组分区的图片墙与建筑详情。**

默认分区键固定为 `building.building_group.key`，展示顺序使用 `building_group.order` 与中文名；抽象分区函数只接收策略键，不在本轮暴露替代分类的界面。

```js
function groupBuildingsByStrategy(rows, strategy = "building_group") {
  if (strategy !== "building_group") throw new Error(`Unsupported building grouping strategy: ${strategy}`);
  const groups = new Map();
  for (const building of rows) {
    const key = building.building_group.key;
    const group = groups.get(key) || {
      key,
      label: building.building_group.name_zh,
      order: building.building_group.order,
      all: [],
      visible: [],
    };
    group.all.push(building);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) => left.order - right.order || left.label.localeCompare(right.label, "zh-Hans-CN"));
}

function renderBuildingBoard() {
  const query = state.buildingSearch.trim().toLocaleLowerCase("zh-Hans-CN");
  const groups = groupBuildingsByStrategy(buildings).map((group) => ({
    ...group,
    visible: group.all.filter((building) => [building.name_zh, building.description_zh, building.key].join("\n").toLocaleLowerCase("zh-Hans-CN").includes(query)),
  })).filter((group) => group.visible.length);
  const visible = groups.flatMap((group) => group.visible).length;
  els.countryList.innerHTML = `<section class="economy-shell economy-shell--building">${renderEconomyToolbar({ kind: "building", total: buildings.length, visible, label: "建筑", query: state.buildingSearch })}${groups.map(buildingGroupHtml).join("")}</section>`;
  bindBuildingBoardEvents();
  renderBuildingDetail(economyBuildingByKey.get(state.selectedBuilding) || null);
}
```

`buildingGroupHtml` 对空搜索结果显示明确提示。卡片设置 `data-building-key`、`loading="lazy"`、`decoding="async"`，点击保存 `buildingWallScrollTop` 后改写为 `#/building/<key>`。

建筑详情显示名称、建筑组、城市类型、建造需求、解锁科技、描述和资源地图按钮。`resource_map_available` 为真时才渲染按钮，点击时写入 `#/region/resource/<building-key>` 并执行 `applyHash()`、`render()`。

- [ ] **Step 4: 实现横排生产方式、选中详情和全部组合结果。**

每个生产方式组渲染为独立一行；该组的图标横向排列。首次打开建筑时选择每组第一个生产方式，点击只改变当前建筑对应组的选择。选中生产方式下方展示前置科技、可用条件、投入产出、就业、建筑/州/国家修正及缩放方式。

```js
function selectedMethodsForBuilding(building) {
  const groups = productionMethodGroupsForBuilding(building);
  const selected = state.selectedProductionMethods[building.key] || {};
  return Object.fromEntries(groups.map((group) => [
    group.key,
    selected[group.key] || group.production_methods[0]?.key || "",
  ]));
}

function productionMethodGroupsForBuilding(building) {
  return (building.production_method_group_keys || []).map((groupKey) => {
    const group = productionMethodGroupByKey.get(groupKey);
    if (!group) return null;
    return {
      ...group,
      production_methods: (group.production_method_keys || [])
        .map((methodKey) => productionMethodByKey.get(methodKey))
        .filter(Boolean),
    };
  }).filter(Boolean);
}

function cartesianProduct(groups) {
  return groups.reduce((rows, group) => rows.flatMap((row) => group.map((method) => [...row, method])), [[]]);
}

function aggregateUnconditionalEffects(methods) {
  const totals = new Map();
  for (const effect of methods.flatMap((method) => method.effects || [])) {
    if (effect.condition) continue;
    const key = `${effect.scope}|${effect.scaling}|${effect.key}`;
    totals.set(key, { ...effect, value: (totals.get(key)?.value || 0) + effect.value });
  }
  return [...totals.values()];
}
```

详情先显示“当前组合结果”，使用当前横排选择的生产方式。其下的“全部可能组合”使用每组方法的笛卡尔积，油井渲染 6 行。每行列出各组方法名、无条件合计修正和条件修正。条件修正单列显示条件摘要及原始修正，不计入无条件合计，防止把法律、科技、地区特质或建筑等级的前提效果错误相加。

- [ ] **Step 5: 实现资源地图深链接。**

在 `applyHash()` 的一般 `region` 分支之前解析资源路径，清空旧资源选择后只写入目标建筑键；保留 `regionListMode = "state"`、`regionMapView = "default"` 和空 `mapSubject`，让现有 `syncMapModeForView()` 自动进入资源分布图。

```js
if (parts[0] === "region" && parts[1] === "resource" && parts[2]) {
  const buildingKey = decodeURIComponent(parts[2]);
  changeBoard("region", "stateRegion");
  state.regionListMode = "state";
  state.regionMapView = "default";
  state.resourceFilters.clear();
  state.resourceFilters.add(buildingKey);
  state.mapSubject = "";
  return;
}
```

`map.js` 不新增地图模式；只确认资源筛选非空时保留既有 `resourceSelection` 状态。这样从农业或资源建筑进入时会自动选中对应资源并显示分布，普通建筑没有该入口。

- [ ] **Step 6: 运行建筑静态与浏览器校验。**

Run:

```powershell
node scripts/check_economy_board_contract.mjs
node scripts/check_economy_boards_browser.mjs http://127.0.0.1:8876/index.html
```

Expected: 油井详情有两条生产方式行、6 个组合结果，点击资源按钮后地址为 `#/region/resource/building_oil_rig` 且资源筛选为选中状态。

- [ ] **Step 7: 提交建筑交互。**

```powershell
git add site/app/economy.js site/app/ui.js site/app/map.js site/styles/economy.css scripts/check_economy_board_contract.mjs scripts/check_economy_boards_browser.mjs
git commit -m "feat: add building production method details"
```

### Task 5: 商品图片墙、生产建筑与名贵商品变体

**Files:**

- Modify: `site/app/economy.js: 商品墙、商品详情、建筑交叉跳转`
- Modify: `site/styles/economy.css: 商品详情与名贵商品卡片`
- Modify: `scripts/check_economy_board_contract.mjs`
- Modify: `scripts/check_economy_boards_browser.mjs`

- [ ] **Step 1: 写商品边界失败断言。**

```js
assert.equal(goods.length, 53, "goods wall must contain every base good and no prestige-only card");
assert.match(app, /function renderGoodsBoard\(/, "goods wall renderer must exist");
assert.match(app, /data-good-producer-building/, "goods detail must expose producing-building controls");
assert.match(app, /function renderPrestigeGoods\(/, "goods detail must render prestige variants");
assert.doesNotMatch(app, /renderGoodsDetail[\s\S]*production_method_groups/, "goods detail must not show production-method choices");
```

浏览器脚本读取 `data-goods.js`，选择有 `prestige_goods.length > 0` 的基础商品，断言图片墙为 53 张基础商品卡片、详情存在至少一个 `data-good-producer-building` 与一个 `data-prestige-good-key`，且没有 `[data-production-method-key]`。

- [ ] **Step 2: 运行校验，确认商品详情尚未实现。**

Run:

```powershell
node scripts/check_economy_board_contract.mjs
node scripts/check_economy_boards_browser.mjs http://127.0.0.1:8876/index.html
```

Expected: FAIL，报出缺少 `renderGoodsBoard` 或商品生产建筑控制。

- [ ] **Step 3: 实现商品图片墙和详情。**

商品墙按数据库 `category` 分区，搜索范围为中文名、描述和键。卡片只使用基础商品的 `icon.site_path`，不插入名贵商品卡片。

```js
function renderGoodsBoard() {
  const groups = orderedGoodsGroups(goods, state.goodsSearch);
  els.countryList.innerHTML = `<section class="economy-shell economy-shell--goods">${renderEconomyToolbar({ kind: "goods", total: goods.length, visible: groups.flatMap((group) => group.visible).length, label: "商品" })}${groups.map(goodsGroupHtml).join("")}</section>`;
  bindGoodsBoardEvents();
  renderGoodsDetail(goodByKey.get(state.selectedGood) || null);
}

function goodProducerHtml(building) {
  return `<button type="button" data-good-producer-building="${escapeHtml(building.key)}"><img src="${escapeHtml(building.icon_path)}" alt="">${escapeHtml(building.name_zh)}</button>`;
}
```

商品详情显示分类、价格、本地商品属性、说明与“可生产该商品的建筑”。生产建筑按钮改写为 `#/building/<key>`，等待建筑数据块加载后打开建筑详情。此页不得读取或展示 `production_method_groups`、方法图标、方法条件或组合结果。

- [ ] **Step 4: 将名贵商品限定为详情变体。**

按 `base_good_key` 过滤 `prestigeGoods`，仅在存在变体时显示“名贵商品”分节。每张变体卡片显示图标、中文名和描述，`data-prestige-good-key` 只用于可访问性与浏览器校验，不创建独立路由或图片墙入口。

```js
function renderPrestigeGoods(good) {
  const variants = prestigeGoods.filter((item) => item.base_good_key === good.key);
  if (!variants.length) return "";
  return `<section class="economy-prestige-goods"><h3>名贵商品</h3><div>${variants.map((item) => `<article data-prestige-good-key="${escapeHtml(item.key)}"><img src="${escapeHtml(item.icon.site_path)}" alt=""><h4>${escapeHtml(item.name_zh)}</h4><p>${escapeHtml(item.description_zh)}</p></article>`).join("")}</div></section>`;
}
```

- [ ] **Step 5: 运行商品静态与浏览器校验。**

Run:

```powershell
node scripts/check_economy_board_contract.mjs
node scripts/check_economy_boards_browser.mjs http://127.0.0.1:8876/index.html
```

Expected: 商品图片墙为 53 张基础商品卡片；详情只显示生产建筑和名贵商品变体；点击生产建筑后进入对应建筑详情。

- [ ] **Step 6: 提交商品交互。**

```powershell
git add site/app/economy.js site/styles/economy.css scripts/check_economy_board_contract.mjs scripts/check_economy_boards_browser.mjs
git commit -m "feat: add goods board and prestige variants"
```

### Task 6: 全量再生成、回归、文档与交付校验

**Files:**

- Modify: `docs/worklog/2026-08-03.md`（只追加本轮实际命令和结果；文件已由用户建立时保留原有内容）
- Modify: `WORKLOG.md`（记录已完成建筑与商品板块及对应详细记录链接）
- Modify: `README.md`（补齐最终校验命令）

- [ ] **Step 1: 写最终回归命令清单。**

在工作记录中写入以下已执行命令，保留每条命令的退出码与实际结果，不填入推测值：

```powershell
node scripts/check_economy_database.mjs
node scripts/check_economy_assets.mjs
node scripts/check_data_chunking.mjs
node scripts/check_economy_board_contract.mjs
node scripts/check_publish_bundle.mjs
node scripts/check_site_asset_coverage.mjs
node scripts/check_achievement_board_contract.mjs
node scripts/serve_site.mjs site 8876
node scripts/check_economy_boards_browser.mjs http://127.0.0.1:8876/index.html
git diff --check
```

- [ ] **Step 2: 重新生成全部可发布经济资料。**

Run:

```powershell
node scripts/extract_vic3_countries.mjs --game-path "D:\SteamLibrary\steamapps\common\Victoria 3" --version 1.13.9 --out output\vic3_1.13.9 --database database\vic3_1.13.9
node scripts/build_economy_assets.mjs
node scripts/build_wiki.mjs --database database\vic3_1.13.9 --out site\versions\1.13.9
```

Expected: 数据库含 102 个图片墙建筑、14 个审计排除项、53 个基础商品、72 个名贵商品；发布数据索引含 `building` 与 `goods`。

- [ ] **Step 3: 串行执行静态与浏览器回归。**

先完成全部静态命令，再启动一次站点服务并只运行一次浏览器脚本，避免多个 Chrome 与脚本同时争用端口和调试端口。若 `check_site_asset_coverage.mjs` 因本机缺少其既有的 `game/` 镜像而失败，记录该准确错误；经济资源校验仍必须对数据库声明的游戏目录通过。

```powershell
node scripts/check_economy_database.mjs
node scripts/check_economy_assets.mjs
node scripts/check_data_chunking.mjs
node scripts/check_economy_board_contract.mjs
node scripts/check_publish_bundle.mjs
node scripts/check_achievement_board_contract.mjs
node scripts/serve_site.mjs site 8876
node scripts/check_economy_boards_browser.mjs http://127.0.0.1:8876/index.html
git diff --check
```

Expected: 所有可执行校验通过；浏览器检查确认建筑与商品入口、102 张建筑卡片、53 张商品卡片、油井 6 种组合、资源分布跳转、商品生产建筑跳转和名贵商品详情。

- [ ] **Step 4: 审阅变更范围与提交最终记录。**

```powershell
git status --short
git diff --check
git add WORKLOG.md docs/worklog/2026-08-03.md README.md
git commit -m "docs: record buildings and goods board verification"
```

只暂存本轮明确修改的记录文件；工作区已有的 `Victorian`、`screenshots/`、其他工作日志、临时审计脚本和缓存目录不加入提交。

## 计划自检

设计中的两个独立板块、仅主站 1.13.9、全建筑范围、所有商品、名贵商品详情变体、默认建筑组分区、预留分区策略、横排生产方式、条件修正、完整组合、资源地图深链接和商品仅显示生产建筑，分别由 Task 1 至 Task 5 覆盖。Task 2 将两个数据块保持独立，Task 3 用数据块存在性限制历史版本与 Victorian Century 的入口。Task 6 采用串行站点与浏览器校验，并记录实际结果。

文档中使用的前端字段在任务间一致：`buildings`、`buildingGroups`、`productionMethodGroups`、`productionMethods`、`goods`、`prestigeGoods`、`selectedBuilding`、`selectedGood`、`selectedProductionMethods`、`resource_map_available` 和 `base_good_key`。所有代码任务均给出路径、最小实现片段、失败校验、通过命令与提交范围；未保留待定实现项。
