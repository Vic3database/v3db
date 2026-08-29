# 主流文化路径整合时长情景地图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让国家详情中的主流文化路径可以打开整合年数情景地图，用路径完成后的主流文化集合计算地域整合时长，并可恢复国家原始状态。

**Architecture:** `runtime.js` 保存可清除的 `countryIncorporationScenario`，`presentation.js` 从直接、条件、替换和互斥路径生成最终文化集合及情景按钮，`ui.js` 处理按钮点击和恢复操作。`map.js` 让既有整合年数计算接受情景文化覆盖集合，在地图上下文、缓存签名和地域提示中显示情景信息。共享前端同步到 Victorian Century 独立站和 `site/vc`，各版本国家数据继续从各自构建输出读取。

**Tech Stack:** 原生 JavaScript、Node.js `assert`/`vm` 契约脚本、现有无头 Chrome 浏览器检查、`build_wiki.mjs` 和 `build_victorian_century_site.mjs`。

---

### Task 1: 建立情景文化集合的数据与前端契约

**Files:**
- Create: `scripts/check_primary_culture_incorporation_scenario_contract.mjs`
- Modify: `scripts/primary_culture_expansions.mjs:131-150`
- Modify: `scripts/check_primary_culture_expansion_data.mjs:55-80`
- Test output: `site/versions/1.13.11/data-countries-*.js`

- [ ] **Step 1: 写出失败的情景集合测试**

在新契约脚本中加载 `site/app/presentation.js` 与 `site/app/map.js` 的源代码，先断言下列接口存在；同时准备最小国家数据，验证四种路径的最终集合：

```js
assert.match(presentation, /function countryPrimaryCultureScenarioForRoute\(country, route\)/);
assert.match(presentation, /function countryPrimaryCultureScenarioForOption\(country, group, option\)/);
assert.match(map, /function countryIncorporationPrimaryCultures\(selectedCountry\)/);
assert.match(runtime, /countryIncorporationScenario: null/);

const country = { primaryCultures: ["french", "platinean"] };
assert.deepEqual(scenarioForRoute(country, { culture: "catalan", route_kind: "conditional" }).primaryCultures, ["catalan", "french", "platinean"]);
assert.deepEqual(scenarioForRoute(country, { added_culture: "argentine", removed_culture: "platinean", route_kind: "replacement" }).primaryCultures, ["argentine", "french"]);
assert.deepEqual(scenarioForOption({ primaryCultures: ["pashtun", "tajik"] }, { options: [] }, { id: "maimana", added_primary_cultures: ["turkmen", "uzbek"] }).primaryCultures, ["pashtun", "tajik", "turkmen", "uzbek"]);
```

测试还要断言情景包含 `countryTag`、`routeKey`、`title`、`kind`、`primaryCultures`、`condition` 和 `source`，且文化键已排序去重。

- [ ] **Step 2: 运行测试确认失败**

运行：

```powershell
node scripts/check_primary_culture_incorporation_scenario_contract.mjs
```

预期因情景辅助函数、运行时字段和地图覆盖函数不存在而失败。

- [ ] **Step 3: 保存阿富汗互斥选项的形成来源**

在 `PRIMARY_CULTURE_OPTION_GROUPS.AFG.options` 中保持以下结构，确保迈马纳情景能识别完整集合：

```js
{ id: "maimana", added_primary_cultures: ["turkmen", "uzbek"], was_formed_from_any: ["MAI"] }
```

在数据契约中断言坤都士、迈马纳、卡菲里斯坦三组选项的完整文化集合和来源标签。不要把情景集合写入 `maximum_primary_cultures`，该字段继续表达既有最大集合语义。

- [ ] **Step 4: 提交失败测试和数据契约**

```powershell
git add scripts/check_primary_culture_incorporation_scenario_contract.mjs scripts/check_primary_culture_expansion_data.mjs scripts/primary_culture_expansions.mjs
git commit -m "test: define incorporation scenario cultures"
```

### Task 2: 实现情景状态和主流文化集合

**Files:**
- Modify: `site/app/runtime.js:258-266`
- Modify: `site/app/presentation.js:1042-1228`
- Modify: `site/app/ui.js:136-143, 405-409`
- Test: `scripts/check_primary_culture_incorporation_scenario_contract.mjs`

- [ ] **Step 1: 实现纯情景集合辅助函数**

在 `presentation.js` 中新增以下行为，不依赖 DOM：

```js
function countryPrimaryCultureScenarioForRoute(country, route) {
  const cultures = new Set(country.primaryCultures || []);
  if (route.removed_culture) cultures.delete(route.removed_culture);
  if (route.culture || route.added_culture) cultures.add(route.culture || route.added_culture);
  return countryPrimaryCultureScenarioRecord(country, route, [...cultures].sort());
}

function countryPrimaryCultureScenarioForOption(country, group, option) {
  const cultures = new Set(country.primaryCultures || []);
  for (const culture of option.added_primary_cultures || []) cultures.add(culture);
  return countryPrimaryCultureScenarioRecord(country, option, [...cultures].sort(), group.id);
}
```

`countryPrimaryCultureScenarioRecord` 生成稳定 `routeKey`：路径使用 `route_kind/content_type/content_id/source_line`，互斥选项使用 `group.id/option.id`。标题使用文化名称或选项名称，条件与来源保留原对象，不把当前游戏是否满足条件当作已确认事实。

- [ ] **Step 2: 增加运行时状态和清除函数**

在 `runtime.js` 添加：

```js
countryIncorporationScenario: null,
```

在 `ui.js` 或共享 UI 辅助区添加 `clearCountryIncorporationScenario()`，执行：

```js
state.countryIncorporationScenario = null;
state.countryIncorporationMapEnabled = false;
```

切换国家、离开国家板块、关闭整合年数模式时调用清除函数；单纯刷新地图路径不应清除情景。

- [ ] **Step 3: 绑定情景按钮和恢复按钮**

在 `presentation.js` 的每条路线和互斥选项中添加：

```html
<button type="button"
  class="country-primary-culture-scenario-button"
  data-primary-culture-scenario-route="<stable route key>">
  查看在这一情况下的整合时长
</button>
```

在 `ui.js` 的文档点击委托中处理 `data-primary-culture-scenario-route`，从当前国家重建情景记录，设置 `state.selectedTag`、`state.countryIncorporationScenario`、`state.countryIncorporationMapEnabled = true`，然后调用 `render()`。地图上下文中的恢复按钮使用 `data-country-incorporation-scenario-clear`，点击后清除状态并重新渲染国家原始地图。

- [ ] **Step 4: 运行契约确认通过**

运行：

```powershell
node scripts/check_primary_culture_incorporation_scenario_contract.mjs
```

预期输出 `primary culture incorporation scenario contract passed`。

- [ ] **Step 5: 提交状态与情景集合实现**

```powershell
git add site/app/runtime.js site/app/presentation.js site/app/ui.js scripts/check_primary_culture_incorporation_scenario_contract.mjs
git commit -m "feat: add primary culture incorporation scenarios"
```

### Task 3: 让整合年数地图使用情景文化并显示上下文

**Files:**
- Modify: `site/app/map.js:44-86, 122-131, 274-294, 476-542, 1962-1970`
- Modify: `site/index.html:101-103`
- Modify: `site/styles/map.css`, `site/styles/shell.css`
- Modify: `site/locales/ui.zh-Hans.js`, `site/locales/ui.en.js`
- Test: `scripts/check_primary_culture_incorporation_scenario_contract.mjs`

- [ ] **Step 1: 写出地图覆盖参数的失败断言**

扩展契约脚本，断言地图源代码包含：

```js
assert.match(map, /function countryIncorporationPrimaryCultures\(selectedCountry\)/);
assert.match(map, /countryIncorporationScenario/);
assert.match(map, /data-country-incorporation-scenario-clear/);
assert.match(map, /scenario.*primaryCultures|primaryCultures.*scenario/s);
```

使用 `vm` 提取 `countryIncorporationYearsForCulture` 和新的覆盖辅助函数，证明默认国家文化结果与情景文化结果不同。

- [ ] **Step 2: 实现情景文化读取和缓存签名**

新增：

```js
function countryIncorporationPrimaryCultures(selectedCountry) {
  const scenario = state.countryIncorporationScenario;
  const keys = scenario?.countryTag === selectedCountry?.tag
    ? scenario.primaryCultures
    : selectedCountry?.primaryCultures || [];
  return keys.map((key) => byCulture.get(key) || { key }).filter(Boolean);
}
```

让 `countryIncorporationForStateRegion` 使用该函数，而不是直接读取 `selectedCountry.primaryCultures`。在 `mapLayerSignature()` 的 `countryIncorporation` 分支加入 `scenario:${routeKey}` 和 `scenarioCultures:${...}`。地图关闭或切换国家时签名必须回到无情景状态。

- [ ] **Step 3: 渲染情景上下文和恢复按钮**

扩展 `renderMapCountryContext()`：国家名称和标签后显示情景标题；有情景时加入按钮：

```html
<button type="button" class="map-country-context-reset" data-country-incorporation-scenario-clear>
  恢复当前国家
</button>
```

没有情景时保持当前国家上下文样式。情景提示必须使用现有中英文词条，不显示内部路径编号。

- [ ] **Step 4: 增加地域提示和条件说明**

在 `mapTooltipRowsForView()` 的 `countryIncorporation` 分支中保留现有四行，并在情景存在时增加：

```js
[t("map.countryIncorporation.scenario", "计算情景"), scenarioTitle],
[t("map.countryIncorporation.scenarioCondition", "前提"), conditionSummary],
```

`conditionSummary` 只描述已记录的路径条件，例如“满足语言政策条件”；不写“游戏中已满足”。

- [ ] **Step 5: 添加样式和本地化**

在地图上下文样式中为情景标题和恢复按钮增加换行、最小宽度和窄屏布局；加入中英文词条：

```js
"map.countryIncorporation.scenario"
"map.countryIncorporation.scenarioCondition"
"map.countryIncorporation.scenarioRestore"
"map.countryIncorporation.scenarioPrefix"
```

恢复按钮使用现有地图工具按钮视觉规则，不覆盖国家旗帜和国家标签。

- [ ] **Step 6: 运行地图契约和语法检查**

```powershell
node scripts/check_primary_culture_incorporation_scenario_contract.mjs
node scripts/check_country_incorporation_contract.mjs
node --check site/app/map.js
node --check site/app/presentation.js
node --check site/app/ui.js
```

预期所有命令退出码为 0。

- [ ] **Step 7: 提交地图情景实现**

```powershell
git add site/app/map.js site/index.html site/styles/map.css site/styles/shell.css site/locales/ui.zh-Hans.js site/locales/ui.en.js scripts/check_primary_culture_incorporation_scenario_contract.mjs
git commit -m "feat: show incorporation scenario context"
```

### Task 4: 同步构建原版、Victorian Century 与可检查独立站

**Files:**
- Modify generated vanilla output: `site/versions/1.13.11/data-countries-*.js`, `site/versions/1.13.11/data-index.js` only when emitted by the build
- Modify generated VC output: `Victorian Century Database/data-countries-*.js`, `Victorian Century Database/data-index.js`
- Modify shared VC publish output: `site/vc/**` only when the standalone build is explicitly run
- Test: `scripts/check_primary_culture_incorporation_scenario_contract.mjs`

- [ ] **Step 1: 重建原版条件数据和站点块**

使用隔离工作树或临时副本的 `database/vic3_1.13.11`，依次运行：

```powershell
node scripts/primary_culture_expansions.mjs --database <vanilla-database>
node scripts/build_wiki.mjs --database <vanilla-database> --out site/versions/1.13.11
```

确认国家数据包含 `primaryCultureOptionGroups` 的完整选项文化集合，不把临时情景集合写入静态国家字段。

- [ ] **Step 2: 重建 Victorian Century 数据和独立站**

使用 `database/victorian_century` 和当前工作树的 `Victorian Century Database`，运行：

```powershell
node scripts/primary_culture_expansions.mjs --database <vc-database>
node scripts/build_wiki.mjs --database <vc-database> --baseline-database <vanilla-database> --out "Victorian Century Database"
node scripts/build_victorian_century_site.mjs --source site --target "Victorian Century Database" --vc-database <vc-database> --skip-vc-assets
```

确认独立站保留 Victorian Century 配置、主题、VC 数据块和当前共享前端；不要用主站 `index.html` 直接覆盖独立入口。

- [ ] **Step 3: 同步 `site/vc` 并保留检查副本**

仅在需要检查主站内 VC 入口时运行正式构建的 `--publish-target site/vc`；工作树中保留可直接打开的 `Victorian Century Database` 副本。检查 `site/vc` 和独立站的 `presentation.js`、`map.js`、中英文语言包、情景相关数据字段一致。

- [ ] **Step 4: 提交生成输出**

```powershell
git add site/versions/1.13.11 "Victorian Century Database" site/vc
git commit -m "build: sync incorporation scenario data outputs"
```

只提交本功能构建实际变动的文件；若构建删除无关历史内容块，先恢复这些文件再提交。

### Task 5: 浏览器验证情景进入、地图计算和恢复

**Files:**
- Create: `scripts/check_primary_culture_incorporation_scenario_browser.mjs`
- Modify: `scripts/check_primary_culture_incorporation_scenario_contract.mjs` only if browser-discovered contract needs a static assertion
- Test sites: `site`, `Victorian Century Database`, `site/vc`

- [ ] **Step 1: 编写失败浏览器测试**

使用现有 Chrome 调试工具，启动主站和工作树 VC 独立站预览。原版桌面检查：

```js
await page.goto(`${vanillaUrl}#/country/FRA`);
await page.click("[data-primary-culture-key='catalan'] summary");
await page.click("[data-primary-culture-scenario-route]");
await page.waitFor(() => state.mapMode === "countryIncorporation" && state.countryIncorporationScenario?.countryTag === "FRA", "French incorporation scenario");
assert.match(await page.text("#mapCountryContext"), /加泰罗尼亚/);
```

断言地图地域提示出现情景标题，且情景文化集合包含 `french`、`catalan`。点击恢复按钮后断言 `state.countryIncorporationScenario === null`，地图仍可切换但重新使用法国原始文化集合。

- [ ] **Step 2: 覆盖阿富汗完整互斥路线**

打开 `#/country/AFG`，点击迈马纳选项的情景按钮，断言最终集合同时包含 `turkmen` 和 `uzbek`；再点击恢复。打开坤都士路线，断言集合只新增 `uzbek`，不含 `turkmen`。这两个场景必须得到不同的整合年数地图签名。

- [ ] **Step 3: 覆盖阿根廷替换路线**

打开 `#/country/ARG`，点击替换路径按钮，断言情景集合移除 `platinean`、加入 `argentine`，地图上下文显示替换情景标题和前提信息；恢复后原始 `platinean` 重新出现。

- [ ] **Step 4: 覆盖 Victorian Century、英语和窄屏**

在 VC 独立站重复法国情景进入和恢复，使用英语路径确认标题和“restore current country”本地化；在 442×844 视口检查情景上下文、恢复按钮和地图图例不横向溢出。再检查 `site/vc` 的同一入口，确认共享前端与独立站一致。

- [ ] **Step 5: 运行完整回归**

```powershell
node scripts/check_primary_culture_incorporation_scenario_contract.mjs
node scripts/check_primary_culture_incorporation_scenario_browser.mjs <vanilla-url> <vc-url> <site-vc-url>
node scripts/check_country_incorporation_contract.mjs
node scripts/check_country_incorporation_browser.mjs <vanilla-url>
node scripts/check_multilingual_board_contracts.mjs
node scripts/check_two_level_navigation.mjs
git diff --check
```

`check_two_level_navigation.mjs` 若仍因当前工作树已有的顶栏缓存令牌断言失败，单独记录该基线问题，不修改与本功能无关的缓存链。

- [ ] **Step 6: 记录结果并提交**

在 `docs/worklog/2026-08-25-primary-culture-incorporation-scenario.md` 记录“目标、已完成修改、未解决问题、涉及文件、测试结果、下一步”六个小节。提交浏览器检查、生成输出和工作记录；不自动合并、推送或部署。

```powershell
git add scripts/check_primary_culture_incorporation_scenario_browser.mjs site/versions/1.13.11 "Victorian Century Database" site/vc docs/worklog/2026-08-25-primary-culture-incorporation-scenario.md
git commit -m "test: verify incorporation scenario maps"
```

### Task 6: 最终验证与交接

**Files:**
- Verify only: all files changed by Tasks 1–5

- [ ] **Step 1: 检查提交范围**

运行：

```powershell
git status --short --branch
git diff --check
git log --oneline --decorate -8
```

确认主工作目录未被修改，VC 检查副本仍可通过预览服务器打开。

- [ ] **Step 2: 输出交接信息**

报告隔离工作树路径、分支、情景入口、VC 独立站入口、已运行命令、实际结果，以及未处理的导航缓存基线问题。此阶段不合并、不推送、不公开部署。
