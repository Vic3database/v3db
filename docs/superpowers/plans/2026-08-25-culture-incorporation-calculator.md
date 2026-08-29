# 文化板块整合时长计算器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在文化板块增加可按国家预载、按文化标签自由组合的整合时长计算器，同时保留国家板块的基础整合年数地图并移除旧的路径情景地图功能。

**Architecture:** 新增 `cultureIncorporation` 地图模式和 `site/app/culture-incorporation.js` 计算器模块。计算器状态保存国家标签、已选文化和候选文化来源；国家标签只负责预载，不改变国家数据。`map.js` 把整合年数计算抽象为接受文化集合的通用函数，国家基础地图传入国家默认文化，文化计算器传入用户集合。移除 `countryIncorporationScenario`、路径情景按钮、情景上下文和旧情景测试，保留 `countryIncorporationMapButton` 的基础国家地图模式。

**Tech Stack:** 原生 JavaScript、Node.js `assert`/`vm` 契约脚本、现有静态数据块、无头 Chrome 检查、`build_victorian_century_site.mjs`。

---

### Task 1: 建立计算器数据、路由和旧情景移除契约

**Files:**
- Create: `scripts/check_culture_incorporation_calculator_contract.mjs`
- Modify: `site/app/runtime.js:258-266`
- Modify: `site/app/ui.js:136-160, 1280-1320, 1660-1685`
- Modify: `site/app/presentation.js:1042-1300`
- Delete: `scripts/check_primary_culture_incorporation_scenario_contract.mjs`
- Delete: `scripts/check_primary_culture_incorporation_scenario_browser.mjs`

- [ ] **Step 1: 写出失败契约**

新建契约脚本，读取 `runtime.js`、`ui.js`、`presentation.js`、`map.js`、`index.html` 和 `site/app/culture-incorporation.js`，先断言新接口和旧接口状态：

```js
assert.match(runtime, /incorporationCalculatorCountryTag: ""/);
assert.match(runtime, /incorporationCalculatorCultures: new Set\(\)/);
assert.match(ui, /culture\/incorporation/);
assert.match(presentation, /function incorporationCalculatorCandidates\(country\)/);
assert.match(map, /function buildCultureIncorporationMapFeatures\(\)/);
assert.match(indexHtml, /app\/culture-incorporation\.js/);
assert.doesNotMatch(runtime, /countryIncorporationScenario/);
assert.doesNotMatch(presentation, /data-primary-culture-scenario-route/);
assert.doesNotMatch(ui, /data-country-incorporation-scenario-clear/);
```

从站点国家数据读取 `AUS`，通过 `vm` 提取候选文化函数，要求候选键包含 `hungarian`、`czech`、`slovak`、`croat`、`serb`、`slovene`、`polish`、`romanian`、`ukrainian`、`north_italian`、`szekely`，且默认文化只为 `south_german`。测试空集合计算状态必须返回 `empty: true`，不能把空集合当作 25 年。

- [ ] **Step 2: 运行失败测试**

运行：

```powershell
node scripts/check_culture_incorporation_calculator_contract.mjs
```

预期因计算器模块、路由、状态和旧情景清理尚未完成而失败。

- [ ] **Step 3: 删除旧情景测试并清点旧代码入口**

记录旧情景代码必须移除的符号：`countryIncorporationScenario`、`countryPrimaryCultureScenarioRecord`、`countryPrimaryCultureScenarioForRoute`、`countryPrimaryCultureScenarioForOption`、`countryPrimaryCultureScenarioForRouteKey`、`data-primary-culture-scenario-route`、`data-country-incorporation-scenario-clear`。不要删除 `countryIncorporationMapEnabled`、`countryIncorporationForStateRegion` 或基础整合年数契约。

- [ ] **Step 4: 提交失败契约**

```powershell
git add scripts/check_culture_incorporation_calculator_contract.mjs
git rm scripts/check_primary_culture_incorporation_scenario_contract.mjs scripts/check_primary_culture_incorporation_scenario_browser.mjs
git commit -m "test: define culture incorporation calculator contract"
```

### Task 2: 实现文化计算器状态、路由和候选文化

**Files:**
- Create: `site/app/culture-incorporation.js`
- Modify: `site/app/runtime.js:258-266`
- Modify: `site/app/ui.js:136-160, 1308-1316, 1495-1505, 1668-1685`
- Modify: `site/app/boards.js:1563-1585`
- Modify: `site/app/presentation.js:1042-1300`
- Modify: `site/index.html:447-455`
- Test: `scripts/check_culture_incorporation_calculator_contract.mjs`

- [ ] **Step 1: 增加计算器状态**

在 `runtime.js` 添加并初始化：

```js
incorporationCalculatorCountryTag: "",
incorporationCalculatorCultures: new Set(),
incorporationCalculatorCandidateCultures: new Map(),
incorporationCalculatorSearch: "",
```

不要再创建 `countryIncorporationScenario`。切换到其他板块时清除计算器状态；在同一计算器路由内改变文化时保留国家标签。

- [ ] **Step 2: 添加计算器模块和候选来源**

创建 `site/app/culture-incorporation.js`，实现：

```js
function incorporationCalculatorCandidates(country) {
  const candidates = new Map();
  const add = (cultureKey, source) => {
    if (!cultureKey || candidates.has(cultureKey)) return;
    candidates.set(cultureKey, { key: cultureKey, sources: [source] });
  };
  for (const key of country?.primaryCultures || []) add(key, { kind: "primary" });
  for (const path of [...(country?.primaryCultureExpansionPaths || []), ...(country?.primaryCultureConditionalPaths || [])]) {
    add(path.culture, { kind: "path", content_id: path.content_id, source_file: path.source_file, source_line: path.source_line });
  }
  for (const group of country?.primaryCultureOptionGroups || []) {
    for (const option of group.options || []) {
      for (const key of option.added_primary_cultures || []) add(key, { kind: "option", group_id: group.id, option_id: option.id, source_file: group.source_file || "" });
    }
  }
  return [...candidates.values()];
}
```

同一互斥选项的文化保留相同 `group_id`/`option_id`，方便 UI 将阿富汗迈马纳的乌兹别克和土库曼显示在同一候选组；候选默认不加入已选集合。候选排序先按是否国家默认文化、来源组、当前语言文化名。

- [ ] **Step 3: 添加计算器路由**

在 `applyHash()` 的文化路由前加入：

```js
if (parts[0] === "culture" && parts[1] === "incorporation") {
  changeBoard("culture", "cultureIncorporation");
  state.incorporationCalculatorCountryTag = parts[2] && byTag.has(parts[2].toUpperCase()) ? parts[2].toUpperCase() : "";
  initializeIncorporationCalculatorFromCountry(state.incorporationCalculatorCountryTag);
  return;
}
```

`initializeIncorporationCalculatorFromCountry(tag)` 只在国家标签改变时把国家 `primaryCultures` 写入 `incorporationCalculatorCultures`，并从候选函数更新候选集合；同一路由内重新渲染不得覆盖用户手动选择。文化板块入口使用 `#/culture/incorporation`，国家详情入口使用 `#/culture/incorporation/<TAG>`。

- [ ] **Step 4: 在文化板块分支渲染计算器**

`renderCultureBoard()` 检测 `state.detailKind === "cultureIncorporation"` 时调用 `renderCultureIncorporationCalculator()`，不渲染普通文化列表。计算器模块负责在 `#countryList` 输出三块内容：

```html
<section class="culture-incorporation-calculator" data-culture-incorporation-calculator>
  <header>国家标签、默认主流文化和计算说明</header>
  <section data-incorporation-selected></section>
  <section data-incorporation-candidates></section>
  <section data-incorporation-results></section>
</section>
```

候选标签使用 `data-incorporation-candidate`，已选标签使用 `data-incorporation-selected-culture`；删除已选文化、添加候选文化和搜索输入都只更新计算器状态并重新渲染。

- [ ] **Step 5: 接入脚本和静态契约**

在 `index.html` 加载 `app/culture-incorporation.js`，更新该脚本和文化板块相关共享样式缓存参数。运行：

```powershell
node scripts/check_culture_incorporation_calculator_contract.mjs
node --check site/app/culture-incorporation.js
node --check site/app/ui.js
```

预期输出 `culture incorporation calculator contract passed`。

- [ ] **Step 6: 提交计算器状态和候选功能**

```powershell
git add site/app/culture-incorporation.js site/app/runtime.js site/app/ui.js site/app/boards.js site/app/presentation.js site/index.html scripts/check_culture_incorporation_calculator_contract.mjs
git commit -m "feat: add culture incorporation calculator"
```

### Task 3: 实现计算结果、地图模式和双语界面

**Files:**
- Modify: `site/app/map.js:476-542, 274-298, 1937-1985`
- Modify: `site/app/culture-incorporation.js`
- Modify: `site/app/runtime.js`
- Modify: `site/index.html:101-124`
- Modify: `site/styles/map.css`, `site/styles/records.css`
- Modify: `site/locales/ui.zh-Hans.js`, `site/locales/ui.en.js`
- Test: `scripts/check_culture_incorporation_calculator_contract.mjs`

- [ ] **Step 1: 抽象整合年数函数**

将 `countryIncorporationForStateRegion(stateRegion, selectedCountry)` 改为：

```js
function countryIncorporationForStateRegion(stateRegion, selectedCountry, primaryCultureOverride = null) {
  const primaryCultures = primaryCultureOverride || (selectedCountry?.primaryCultures || [])
    .map((cultureRef) => byCulture.get(cultureRef?.key || cultureRef) || cultureRef)
    .filter(Boolean);
  // existing homeland comparison and minimum-year selection
}
```

删除 `countryIncorporationPrimaryCultures()` 对 `countryIncorporationScenario` 的读取。国家基础地图传入 `null`，文化计算器传入已选文化对象。

- [ ] **Step 2: 增加文化计算器地图模式**

在 `syncMapModeForView()` 中，当 `state.view === "culture" && state.detailKind === "cultureIncorporation"` 时设置 `state.mapMode = "cultureIncorporation"`。`buildMapFeatures()` 增加 `buildCultureIncorporationMapFeatures()`：

```js
function buildCultureIncorporationMapFeatures() {
  const cultures = incorporationCalculatorSelectedCultureObjects();
  const features = new Map();
  for (const stateRegion of stateRegions) {
    const relation = isSeaStateRegion(stateRegion)
      ? { years: 0, culture: null }
      : cultures.length
        ? countryIncorporationForStateRegion(stateRegion, null, cultures)
        : { years: null, culture: null };
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, relation.years ? countryIncorporationColor(relation.years, false) : "#7a7f82"),
      active: Boolean(cultures.length && !isSeaStateRegion(stateRegion)),
      value: relation.years,
      title: relation.years ? incorporationCalculatorResultTitle(stateRegion, relation) : t("map.cultureIncorporation.empty", "请选择文化"),
      incorporation: relation,
    });
  }
  return features;
}
```

加入 `cultureIncorporation` 的缓存签名，包含已选文化键集合和国家标签。普通国家整合年数模式继续使用 `countryIncorporation`，不读取计算器状态。

- [ ] **Step 3: 添加结果列表和地域提示**

计算器模块按年数分组渲染地域列表，每项显示地域名、年数和命中的本土文化/已选文化；空集合显示空状态。地图提示为 `cultureIncorporation` 增加“本土文化”“命中文化”“整合年数”三行，不显示国家基础地图的开局归属字段。

- [ ] **Step 4: 移除旧情景地图逻辑**

从 `runtime.js` 删除 `countryIncorporationScenario`；从 `presentation.js` 删除情景记录函数、情景按钮和路径按钮生成；从 `ui.js` 删除情景点击委托与清除函数；从 `map.js` 删除情景上下文、情景缓存字段和情景提示。保留国家基础整合年数按钮、五档图例和 `countryIncorporationForStateRegion`。

- [ ] **Step 5: 加入中文和英文词条与样式**

增加：

```js
"nav.cultureIncorporation"
"board.culture.incorporation.title"
"board.culture.incorporation.selected"
"board.culture.incorporation.candidates"
"board.culture.incorporation.search"
"board.culture.incorporation.empty"
"board.culture.incorporation.add"
"board.culture.incorporation.remove"
"board.culture.incorporation.calculate"
"board.culture.incorporation.resultCount"
"map.cultureIncorporation.empty"
"map.cultureIncorporation.match"
```

样式要求候选标签、已选标签、结果列表在 442 像素下自动换行；地图上下文显示当前国家标签和已选文化数量，不覆盖现有整合年数图例。

- [ ] **Step 6: 运行契约和语法检查**

```powershell
node scripts/check_culture_incorporation_calculator_contract.mjs
node scripts/check_country_incorporation_contract.mjs
node --check site/app/culture-incorporation.js
node --check site/app/map.js
node --check site/app/presentation.js
node --check site/app/ui.js
```

预期所有命令退出码为 0。

- [ ] **Step 7: 提交地图和界面实现**

```powershell
git add site/app/culture-incorporation.js site/app/runtime.js site/app/presentation.js site/app/ui.js site/app/map.js site/index.html site/styles/map.css site/styles/records.css site/locales/ui.zh-Hans.js site/locales/ui.en.js scripts/check_culture_incorporation_calculator_contract.mjs
git commit -m "feat: calculate incorporation time from culture selections"
```

### Task 4: 同步原版、Victorian Century 和 VC 检查副本

**Files:**
- Modify generated vanilla output only when required: `site/versions/1.13.11/data-countries-*.js`, `site/versions/1.13.11/data-index.js`
- Modify ignored check copy: `Victorian Century Database/**`
- Modify ignored published copy: `site/vc/**`
- Test: `scripts/check_culture_incorporation_calculator_contract.mjs`

- [ ] **Step 1: 重建原版数据块**

使用临时副本生成 `primary_culture_expansions.json`，运行 `build_wiki.mjs` 输出原版 1.13.11；恢复构建删除的历史内容块，只保留包含候选路径字段的国家数据变化。

- [ ] **Step 2: 重建 VC 独立站**

使用 `database/victorian_century` 生成 VC 条件数据，再运行：

```powershell
node scripts/build_wiki.mjs --database <vc-database> --baseline-database <vanilla-database> --out "Victorian Century Database"
node scripts/build_victorian_century_site.mjs --source site --target "Victorian Century Database" --vc-database <vc-database> --skip-vc-assets
```

确认独立入口保留 `victorian-century-config.js`，共享前端包含文化计算器路由和地图模式。

- [ ] **Step 3: 同步 `site/vc`**

运行同一构建的 `--publish-target site/vc`，确认 `site/vc/index.html`、共享前端、双语语言包和 VC 数据块一致。当前工作树的 VC 副本用于浏览器检查，不自动发布到服务器。

- [ ] **Step 4: 提交构建输出**

```powershell
git add site/versions/1.13.11
git commit -m "build: sync culture incorporation calculator data"
```

`Victorian Century Database` 和 `site/vc` 按当前忽略规则作为检查副本保留，不强行加入提交；若项目发布规则要求跟踪这些目录，再单独确认文件范围。

### Task 5: 浏览器验证计算器和旧情景移除

**Files:**
- Create: `scripts/check_culture_incorporation_calculator_browser.mjs`
- Test sites: `site`, `Victorian Century Database`, `site/vc`
- Delete from regression list: `scripts/check_primary_culture_incorporation_scenario_browser.mjs`

- [ ] **Step 1: 写出失败浏览器测试**

打开 `#/culture/incorporation/AUS`，断言默认已选文化只有南德意志，候选列表包含匈牙利、捷克和斯洛伐克。点击匈牙利、捷克、斯洛伐克，断言已选标签和地图模式更新，结果列表出现 2、5、10、15、25 档中的实际结果。

- [ ] **Step 2: 验证添加、删除和空状态**

删除捷克后，已选集合不再包含捷克；清空所有文化后，结果列表显示“请选择文化”，地图不把地域全部标为 25 年；再次加入南德意志后结果恢复。

- [ ] **Step 3: 验证国家标签和候选来源**

打开 `#/culture/incorporation/FRA`，断言默认法国文化已选；打开 `#/culture/incorporation/AUS`，断言候选文化来自奥地利联邦路径。阿富汗候选中，迈马纳选项的乌兹别克和土库曼显示同一候选组来源。

- [ ] **Step 4: 验证三套站点和窄屏**

对主站、Victorian Century 独立站和 `site/vc` 重复国家标签预载、添加和删除操作；使用英语检查标题和按钮本地化；在 442×844 检查文化标签、候选区、结果列表和地图图例没有横向溢出。

- [ ] **Step 5: 确认旧路径情景已移除、基础地图仍保留**

打开国家详情，断言不存在 `[data-primary-culture-scenario-route]`；打开国家板块，断言 `countryIncorporationMapButton` 仍能切换基础整合年数地图。运行：

```powershell
node scripts/check_culture_incorporation_calculator_browser.mjs <vanilla-url> <vc-url> <site-vc-url>
node scripts/check_culture_incorporation_calculator_contract.mjs
node scripts/check_country_incorporation_contract.mjs
node scripts/check_multilingual_board_contracts.mjs
node scripts/check_two_level_navigation.mjs
git diff --check
```

顶栏缓存断言若仍失败，单独记录为既有基线问题，不修改无关缓存链。

- [ ] **Step 6: 记录并提交**

新增 `docs/worklog/2026-08-25-culture-incorporation-calculator.md`，使用“目标、已完成修改、未解决问题、涉及文件、测试结果、下一步”六个小节；提交浏览器检查和工作记录。

```powershell
git add scripts/check_culture_incorporation_calculator_browser.mjs docs/worklog/2026-08-25-culture-incorporation-calculator.md
git commit -m "test: verify culture incorporation calculator"
```

### Task 6: 最终验证与交接

**Files:**
- Verify only: files changed by Tasks 1–5

- [ ] **Step 1: 检查工作树和提交**

运行：

```powershell
git status --short --branch
git diff --check
git log --oneline --decorate -10
```

确认主工作目录未修改，VC 独立站检查副本和 `site/vc` 检查副本均可访问。

- [ ] **Step 2: 输出交接信息**

报告文化计算器路由、奥地利默认文化和候选文化、主站/VC/`site/vc` 预览地址、测试命令和既有导航缓存基线问题。不合并、不推送、不公开部署。
