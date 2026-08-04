# 商品详情扩展实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩展主站 1.13.9 简体中文商品详情，完整显示商品属性、生产与消费建筑、人口需求、文化和宗教关系、名贵商品公司，并恢复橡胶种植园的生产关系。

**Architecture:** 在数据库生成阶段读取并校验所有关系，将精简反向引用写进普通商品和名贵商品记录；主站商品路由仍只加载商品数据块。前端在现有右侧详情栏中按资料分区渲染，建筑、文化和公司使用现有路由，宗教使用语义标签。

**Tech Stack:** Node.js、现有 Clausewitz 脚本解析器、原生 JavaScript、CSS、Chrome DevTools Protocol、PowerShell。

---

### Task 1: 恢复合法生产方式并补齐商品定义属性

**Files:**
- Modify: `scripts/check_economy_database.mjs`
- Modify: `scripts/extract_vic3_countries.mjs`
- Generated: `database/vic3_1.13.9/index.json`
- Generated: `database/vic3_1.13.9/README.md`
- Generated: `database/vic3_1.13.9/buildings.json`
- Generated: `database/vic3_1.13.9/production_method_groups.json`
- Generated: `database/vic3_1.13.9/production_methods.json`
- Generated: `database/vic3_1.13.9/goods.json`
- Generated: `site/assets/production-methods/`

- [ ] **Step 1: 写入失败的数据检查**

在 `scripts/check_economy_database.mjs` 增加橡胶生产方式、商品属性和默认值断言：

```js
const goodsByKey = new Map(goods.map((item) => [item.key, item]));
const rubber = required(goodsByKey, "rubber", "rubber good");
const rubberPlantation = required(buildingByKey, "building_rubber_plantation", "rubber plantation");
assert.deepEqual(
  rubberPlantation.production_method_group_keys.map((key) => [key, required(groupByKey, key, key).production_method_keys.length]),
  [["pmg_base_building_rubber_plantation", 2], ["pmg_rubber_exploitation", 3], ["pmg_train_automation_building_rubber_plantation", 2]],
);
assert.equal(required(methodByKey, "default_building_rubber_plantation", "default rubber production").effects.find((effect) => effect.key === "goods_output_rubber_add")?.value, 20);
assert.equal(required(methodByKey, "automatic_irrigation_building_rubber_plantation", "automatic rubber production").effects.find((effect) => effect.key === "goods_output_rubber_add")?.value, 40);
assert.equal(rubber.price, 40);
assert.equal(rubber.tradeable, true);
assert.equal(rubber.is_local, false);
assert.equal(rubber.fixed_price, false);
assert.equal(rubber.traded_quantity, 10);
assert.equal(rubber.convoy_cost_multiplier, 1);
```

- [ ] **Step 2: 运行检查并确认失败**

Run: `node scripts/check_economy_database.mjs`

Expected: FAIL，报告缺少 `default_building_rubber_plantation` 或橡胶商品属性。

- [ ] **Step 3: 修改生产方式和商品读取器**

先读取所有带 `texture` 或被生产方式组引用的顶层生产方式定义，移除 `key.startsWith("pm_")` 条件。生产方式组过滤前建立引用集合；发现引用不存在时抛出包含组和生产方式内部标识的错误。`loadGoods` 写入明确的默认值：

```js
tradeable: firstScalar(node, "tradeable") === "no" ? false : true,
is_local: boolFromYesNo(firstScalar(node, "local")),
fixed_price: boolFromYesNo(firstScalar(node, "fixed_price")),
prestige_factor: toNumberOrNull(firstScalar(node, "prestige_factor")) ?? 0,
traded_quantity: toNumberOrNull(firstScalar(node, "traded_quantity")) ?? 10,
convoy_cost_multiplier: toNumberOrNull(firstScalar(node, "convoy_cost_multiplier")) ?? 1,
obsession_chance: toNumberOrNull(firstScalar(node, "obsession_chance")) ?? 0,
consumption_tax_cost: toNumberOrNull(firstScalar(node, "consumption_tax_cost")),
pop_consumption_can_add_infrastructure: boolFromYesNo(firstScalar(node, "pop_consumption_can_add_infrastructure")),
```

- [ ] **Step 4: 生成临时数据库并运行检查**

Run: `node scripts/extract_vic3_countries.mjs --database tmp/goods-detail-database --out tmp/goods-detail-output`

Expected: 临时数据库生成成功，生产方式数量大于当前 379。

将临时数据库中的 `index.json`、`README.md`、`buildings.json`、`production_method_groups.json`、`production_methods.json` 和 `goods.json` 更新到 `database/vic3_1.13.9/`，随后同步新增的生产方式图标：

Run: `node scripts/build_economy_assets.mjs`

Expected: 所有带图标的新增生产方式均在 `site/assets/production-methods/` 中生成对应 PNG 文件。

再运行：

Run: `node scripts/check_economy_database.mjs`

Expected: 新增断言 PASS，原有经济数据库断言仍 PASS。

- [ ] **Step 5: 提交生产方式和商品属性改动**

```powershell
git add -- scripts/extract_vic3_countries.mjs scripts/check_economy_database.mjs database/vic3_1.13.9/index.json database/vic3_1.13.9/README.md database/vic3_1.13.9/buildings.json database/vic3_1.13.9/production_method_groups.json database/vic3_1.13.9/production_methods.json database/vic3_1.13.9/goods.json site/assets/production-methods
git commit -m "fix: restore complete goods production data"
```

### Task 2: 生成商品的全部反向关系

**Files:**
- Modify: `scripts/check_economy_database.mjs`
- Modify: `scripts/extract_vic3_countries.mjs`
- Generated: `database/vic3_1.13.9/goods.json`
- Generated: `database/vic3_1.13.9/prestige_goods.json`

- [ ] **Step 1: 写入失败的关系检查**

在经济数据库检查中增加以下实例断言：

```js
assert(rubber.producing_buildings.some((item) => item.key === "building_rubber_plantation"));
assert(required(goodsByKey, "tools", "tools").consuming_buildings.length > 0);
const grainNeed = required(goodsByKey, "grain", "grain").pop_needs.find((need) => need.key === "popneed_basic_food");
assert.equal(grainNeed.is_default, true);
assert.deepEqual(grainNeed.wealth_levels.slice(0, 4), [1, 2, 3, 4]);
assert.equal(required(goodsByKey, "oil", "oil").pop_needs.find((need) => need.key === "popneed_heating")?.weight, 3);
assert(required(goodsByKey, "coffee", "coffee").obsessed_cultures.some((item) => item.key === "afro_brazilian"));
assert(required(goodsByKey, "meat", "meat").taboo_cultures.some((item) => item.key === "japanese"));
assert(required(goodsByKey, "meat", "meat").taboo_religions.some((item) => item.key === "hindu"));
assert(required(goodsByKey, "liquor", "liquor").taboo_religions.some((item) => item.key === "sunni"));
assert(prestigeGoods.some((item) => item.companies?.length));
```

- [ ] **Step 2: 运行检查并确认失败**

Run: `node scripts/check_economy_database.mjs`

Expected: FAIL，报告缺少 `consuming_buildings`、`pop_needs` 或文化宗教关系。

- [ ] **Step 3: 扩展宗教、人口需求和购买包读取器**

将 `loadReligions` 的集合值改成包含名称、图标、禁忌商品和来源文件的对象映射；映射仍支持 `.has(key)`。新增 `loadPopNeeds` 和 `loadBuyPackages`，人口需求条目保存：

```js
{
  key,
  name_zh: locCleanName(loc, key),
  default_good_key,
  obsession_demand_min,
  obsession_demand_mult,
  prestige_goods_demand_increase,
  entries: [{ goods_key, weight, max_supply_share, min_supply_share }],
  wealth_levels: [1, 2, 3],
}
```

`loadEconomyData` 接收文化、宗教、公司、人口需求和购买包数据，并为每件普通商品初始化生产建筑、消费建筑、人口需求、痴迷文化、禁忌文化和禁忌宗教数组。

- [ ] **Step 4: 建立反向关系并去重排序**

建筑关系只采集数值大于零的 `goods_output_<key>_add` 和 `goods_input_<key>_add`。文化、宗教、人口需求和名贵商品公司均在生成阶段反查；精简引用分别采用：

```js
{ key: building.key, name_zh: economyDisplayName(building), icon_path: building.icon.site_path }
{ key: culture.key, name_zh: locCleanName(loc, culture.key) }
{ key: religion.key, name_zh: religion.name_zh, icon_path: religion.icon?.site_path || "" }
{ key: company.key, name_zh: company.name_zh, icon: company.icon }
```

- [ ] **Step 5: 重新生成、更新相关数据库文件并验证**

Run: `node scripts/extract_vic3_countries.mjs --database tmp/goods-detail-database --out tmp/goods-detail-output`

将临时数据库中的 `goods.json` 和 `prestige_goods.json` 更新到正式数据库后运行：

Run: `node scripts/check_economy_database.mjs`

Expected: 所有商品关系实例 PASS，橡胶包含橡胶种植园，名贵商品至少有一项公司引用。

- [ ] **Step 6: 提交关系数据改动**

```powershell
git add -- scripts/extract_vic3_countries.mjs scripts/check_economy_database.mjs database/vic3_1.13.9/goods.json database/vic3_1.13.9/prestige_goods.json
git commit -m "feat: add complete goods relationships"
```

### Task 3: 发布独立商品数据块并建立前端契约

**Files:**
- Modify: `scripts/check_economy_board_contract.mjs`
- Modify: `scripts/build_wiki.mjs`
- Generated: `site/versions/1.13.9/data-buildings.js`
- Generated: `site/versions/1.13.9/data-goods.js`

- [ ] **Step 1: 写入失败的商品块契约检查**

要求商品路由仍只加载 `goods` 数据块，并要求详情代码使用新增字段：

```js
assert(appSource.includes('if (view === "goods") return ["goods"]'));
for (const field of ["consuming_buildings", "pop_needs", "obsessed_cultures", "taboo_cultures", "taboo_religions", "consumption_tax_cost"]) {
  assert(appSource.includes(field), `goods detail must render ${field}`);
}
```

- [ ] **Step 2: 运行契约检查并确认失败**

Run: `node scripts/check_economy_board_contract.mjs`

Expected: FAIL，报告商品详情尚未使用新增字段。

- [ ] **Step 3: 从临时目录构建站点并检查商品块**

Run: `node scripts/build_wiki.mjs --source database/vic3_1.13.9/index.json --out tmp/goods-detail-site`

Expected: `tmp/goods-detail-site/data-goods.js` 包含扩展后的普通商品与名贵商品，不要求加载文化、公司或建筑块；`tmp/goods-detail-site/data-buildings.js` 包含恢复后的 436 种生产方式。

- [ ] **Step 4: 更新正式商品数据块**

只用 `Copy-Item -LiteralPath 'tmp/goods-detail-site/data-goods.js' -Destination 'site/versions/1.13.9/data-goods.js' -Force` 和 `Copy-Item -LiteralPath 'tmp/goods-detail-site/data-buildings.js' -Destination 'site/versions/1.13.9/data-buildings.js' -Force` 更新正式商品与建筑数据块；比较其他临时输出仅用于确认构建成功，不覆盖工作区中现有的站点数据文件。

- [ ] **Step 5: 暂缓提交**

商品数据块与详情渲染必须共同通过前端检查，留到 Task 4 一并提交。

### Task 4: 渲染商品详情并补充响应式样式

**Files:**
- Modify: `scripts/check_economy_board_contract.mjs`
- Modify: `scripts/check_economy_board_browser.mjs`
- Modify: `site/app/economy.js`
- Modify: `site/styles/economy.css`
- Modify: `site/index.html`
- Generated: `site/versions/1.13.9/data-buildings.js`
- Generated: `site/versions/1.13.9/data-goods.js`

- [ ] **Step 1: 写入失败的浏览器检查**

扩展商品浏览器用例，依次打开橡胶、谷物、肉类和石油，检查：

```js
assert(rubber.producers.includes("building_rubber_plantation"));
assert.equal(rubber.standardPrice, "£40");
assert(grain.needs.includes("基本食物"));
assert(meat.tabooReligions.includes("印度教"));
assert(oil.consumers.length > 0);
assert.equal(oil.methods, 0);
```

名贵商品用例检查至少一个 `[data-prestige-company]` 链接；窄屏用例使用宽度 390，检查详情内容宽度不超过视口。

- [ ] **Step 2: 运行静态契约并确认失败**

Run: `node scripts/check_economy_board_contract.mjs`

Expected: FAIL，详情函数尚未包含新增区域。

- [ ] **Step 3: 实现详情分区与链接**

在 `site/app/economy.js` 新增小型渲染函数，分别处理定义表格、建筑卡片、人口需求卡片、文化宗教标签、名贵商品公司和空状态。详情顺序固定为基础属性、生产建筑、消费建筑、人口需求、痴迷与禁忌、名贵商品、原始资料。数值格式采用：

```js
const yesNo = (value) => value ? "是" : "否";
const optionalNumber = (value) => Number.isFinite(value) ? formatNumber(value) : "未单独设置";
const consumptionTax = (value) => Number.isFinite(value) ? `${formatNumber(value)}权威` : "不可征收消费税";
```

文化按钮跳转 `#/culture/<key>`，建筑按钮跳转 `#/building/<key>`，公司按钮跳转 `#/company/<key>`。宗教使用带 `data-tag-kind="religion"` 的语义标签，不创建独立宗教路由。原始资料使用默认关闭的 `<details>`。

- [ ] **Step 4: 增加详情样式并更新缓存版本**

在 `site/styles/economy.css` 增加基础属性两列表格、需求卡片、关系标签和名贵商品公司列表样式；在 640 像素以下改为单列属性与双列关系卡片。更新 `site/index.html` 中 `economy.js` 和 `economy.css` 的查询版本，确保浏览器加载新文件。

- [ ] **Step 5: 运行静态检查**

Run: `node scripts/check_economy_board_contract.mjs`

Expected: PASS。

- [ ] **Step 6: 启动临时服务器并运行浏览器检查**

Run: `python -m http.server 4173 --directory site`

另一个串行命令运行：`node scripts/check_economy_board_browser.mjs http://127.0.0.1:4173/index.html`

Expected: PASS，橡胶、需求、禁忌、消费建筑、名贵商品公司和窄屏宽度全部通过。

- [ ] **Step 7: 提交商品详情界面**

```powershell
git add -- docs/superpowers/plans/2026-08-04-goods-detail.md scripts/check_economy_board_contract.mjs scripts/check_economy_board_browser.mjs site/app/economy.js site/styles/economy.css site/index.html site/versions/1.13.9/data-buildings.js site/versions/1.13.9/data-goods.js
git commit -m "feat: expand goods detail records"
```

### Task 5: 完整回归与工作记录

**Files:**
- Modify: `WORKLOG.md`
- Create: `docs/worklog/2026-08-04-goods-detail.md`

- [ ] **Step 1: 运行经济数据、资源和前端静态检查**

Run serially:

```powershell
node scripts/check_economy_database.mjs
node scripts/check_economy_assets.mjs
node scripts/check_economy_board_contract.mjs
node scripts/check_publish_bundle.mjs
```

Expected: 四项全部 PASS。

- [ ] **Step 2: 运行浏览器回归并保存截图**

在本地服务器运行期间重新执行浏览器检查，并保存橡胶、肉类和名贵商品详情的桌面截图与一张 390 像素窄屏截图到 `screenshots/goods-detail/`。检查图片资源无破损、详情滚动正常、长名称无横向溢出。

- [ ] **Step 3: 检查变更边界**

Run: `git status --short` 和 `git diff --check`

Expected: 功能文件无空白错误；用户原有的站点数据、文档、脚本和截图改动仍保持原状态，没有进入本功能提交。

- [ ] **Step 4: 写入工作记录并提交**

详细记录数据来源、关系规则、验证命令和截图路径到 `docs/worklog/2026-08-04-goods-detail.md`，根 `WORKLOG.md` 只增加当前状态与详细记录链接。

```powershell
git add -- WORKLOG.md docs/worklog/2026-08-04-goods-detail.md
git commit -m "docs: record goods detail verification"
```

- [ ] **Step 5: 复核提交与未提交文件**

Run: `git log -5 --oneline` 和 `git status --short`

Expected: 最近提交包含设计、数据、界面和工作记录；未提交列表只保留任务开始前的用户文件及本轮明确保留的验证截图。
