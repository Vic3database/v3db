# 国家整合年数地图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在国家板块增加选中国家后可用的全球整合年数地图，并按游戏定义显示 2、5、10、15、25 年五档颜色和图例。

**Architecture:** 在现有地图模式系统中增加独立的 `countryIncorporation` 模式。`site/app/map.js` 负责纯判定、地图特征、提示和图例，`site/app/boards.js` 负责国家选择后的可见范围，`site/app/runtime.js` 保存模式状态，`site/index.html` 和双语本地化文件提供控件与文字。判定只读取国家主流文化、地区本土文化的具体传承/语言及其组，不读取传统特质。

**Tech Stack:** 原生 JavaScript、Canvas 地图、Node.js 静态契约脚本、Playwright 浏览器检查。

---

### Task 1: 建立整合年数判定测试

**Files:**
- Create: `scripts/check_country_incorporation_contract.mjs`
- Test data: `site/versions/1.13.11/data-cultures.js`, `site/versions/1.13.11/data-countries-1.js`, `site/versions/1.13.11/data-regions.js`

- [ ] **Step 1: 写出失败测试**

在契约脚本中加载 `site/app/map.js` 的源代码，断言存在独立的 `countryIncorporationYearsForCulture` 和 `countryIncorporationForStateRegion` 函数，并用本地数据组装五个最小文化样本，要求结果依次为 2、5、10、15、25；另加一个只有传统特质相同而传承/语言不同的样本，要求结果仍为 25。

- [ ] **Step 2: 运行测试确认失败**

运行 `node scripts/check_country_incorporation_contract.mjs`。预期因函数尚不存在而失败，确认失败原因是缺少新判定实现。

- [ ] **Step 3: 补充可执行的测试接口**

让测试通过 `vm` 注入最小的 `countryIncorporationYearsForCulture` 实现上下文，直接验证输入字段：`key`、`heritage.key`、`language.key`、`heritage.group_key`、`language.group_key`、`traditions`。测试还要断言多个主流文化取最小值，地区没有 `homeland_cultures` 时取 25。

- [ ] **Step 4: 再次运行并确认仍因生产函数缺失而失败**

运行同一命令，预期仍为失败，但错误必须指向地图源代码未包含函数，而非测试数据或脚本语法。

- [ ] **Step 5: 提交测试基线**

```powershell
git add scripts/check_country_incorporation_contract.mjs
git commit -m "test: define country incorporation map contract"
```

### Task 2: 实现基础判定与地图特征

**Files:**
- Modify: `site/app/map.js:360-390, 720-850, 1080-1110, 1780-1825`
- Test: `scripts/check_country_incorporation_contract.mjs`

- [ ] **Step 1: 实现五档判定**

新增 `countryIncorporationYearsForCulture(primaryCultures, homelandCulture)`，按 2、5、10、15、25 顺序比较具体传承、具体语言、传承组、语言组；使用 `primaryCultures.some(...)`，不要访问 `traditions`。新增 `countryIncorporationForStateRegion(stateRegion, selectedCountry)`，对地区全部 `homeland_cultures` 取最小年数并返回 `{ years, labelKey }`。

- [ ] **Step 2: 实现地图特征和颜色**

新增 `buildCountryIncorporationMapFeatures()`，遍历全部 `stateRegions`；海域使用 `MAP_SEA_COLOR`，陆地使用五档固定颜色，地图特征的 `value` 为年数、`active` 为是否有本土文化、`title` 为地区名和图例文案。`buildMapFeatures()` 在 `state.mapMode === "countryIncorporation"` 时调用它。

- [ ] **Step 3: 接入图层缓存签名**

在 `mapLayerSignature()` 为 `countryIncorporation` 加入选中国家标签和主流文化键的签名，避免切换国家后复用旧图层。

- [ ] **Step 4: 更新提示内容**

在 `mapTooltipRowsForView()` 增加 `countryIncorporation` 分支，显示开局归属、当前省份归属、本土文化、基础整合年数和判定档位。

- [ ] **Step 5: 运行判定测试确认通过**

运行 `node scripts/check_country_incorporation_contract.mjs`。预期输出包含 `country incorporation contract passed` 且退出码为 0。

- [ ] **Step 6: 提交地图核心实现**

```powershell
git add site/app/map.js scripts/check_country_incorporation_contract.mjs
git commit -m "feat: calculate country incorporation years"
```

### Task 3: 接入国家板块模式和图例

**Files:**
- Modify: `site/app/runtime.js:200-215`
- Modify: `site/app/map.js:1-125, 225-255`
- Modify: `site/app/boards.js:1532-1550`
- Modify: `site/app/presentation.js:330-355`
- Modify: `site/index.html:100-130`
- Modify: `site/styles/map.css`, `site/styles/shell.css`
- Test: `scripts/check_country_incorporation_contract.mjs`

- [ ] **Step 1: 写出控件和模式失败断言**

在契约脚本中断言存在 `countryIncorporationMapButton`、`countryIncorporationMapLegend`、国家板块专用同步逻辑，以及未选国家时按钮禁用的代码路径。运行脚本确认因 DOM 和逻辑尚未添加而失败。

- [ ] **Step 2: 添加 HTML 控件**

在国家地图工具栏加入按钮和图例容器。按钮使用 `aria-pressed`、`disabled` 和本地化键；图例容器默认隐藏，位置在地图画布下方。

- [ ] **Step 3: 添加运行时状态和模式同步**

在 `runtime.js` 增加 `countryIncorporationMapEnabled: false`。在 `syncMapModeForView()` 中只对 `state.view === "country"` 处理该状态；无 `selectedTag` 时强制关闭，选中国家后允许切换。国家板块其他视图仍使用 `country` 模式。

- [ ] **Step 4: 绑定国家选择和清除行为**

在国家板块渲染和 `commitCountrySelection`、`clearFilteredOutCountryMapSelection` 中同步按钮状态；切换国家时保持整合年数模式，清除国家时恢复 `country` 模式。整合模式的 `renderMap` 入参始终为全部 `stateRegions`，不使用筛选后的国家列表。

- [ ] **Step 5: 渲染五档图例**

新增 `renderCountryIncorporationMapLegend()`，仅在国家板块、已选国家且模式为 `countryIncorporation` 时显示五个色块，文字固定对应 2、5、10、15、25 年。离开模式时清空并隐藏。

- [ ] **Step 6: 添加样式**

复用现有地图图例样式，增加整合年数图例的换行、色块和地图高度规则，确保宽屏与窄屏下图例不会遮挡画布。

- [ ] **Step 7: 运行国家板块契约测试**

运行 `node scripts/check_country_incorporation_contract.mjs`，确认控件、状态、模式、图例和全局地图范围断言全部通过。

- [ ] **Step 8: 提交国家板块接入**

```powershell
git add site/app/runtime.js site/app/map.js site/app/boards.js site/app/presentation.js site/index.html site/styles/map.css site/styles/shell.css scripts/check_country_incorporation_contract.mjs
git commit -m "feat: add country incorporation map mode"
```

### Task 4: 添加中英文文案与缓存版本

**Files:**
- Modify: `site/locales/ui.zh-Hans.js:890-905`
- Modify: `site/locales/ui.en.js:890-905`
- Modify: `site/index.html:430-450`
- Test: `scripts/check_country_incorporation_contract.mjs`

- [ ] **Step 1: 写出文案失败断言**

断言中英文均包含按钮、五档图例、基础年数和判定说明键；运行脚本确认文案键缺失。

- [ ] **Step 2: 添加中文和英文文案**

中文使用 `整合年数`、`基础整合年数`、`2年（文化本土）`、`5年（同传承、同语言）`、`10年（同传承或同语言）`、`15年（同传承组或同语言组）`、`25年（无共同传承组或语言组）`；英文提供对应自然表达。

- [ ] **Step 3: 更新脚本缓存参数**

仅更新本次修改的 `map.js`、`runtime.js`、`boards.js`、`presentation.js`、`ui.zh-Hans.js`、`ui.en.js` 的查询参数，不修改其他脚本版本串。

- [ ] **Step 4: 运行文案契约测试并提交**

运行 `node scripts/check_country_incorporation_contract.mjs`，确认中英文文案和脚本引用均通过；提交：

```powershell
git add site/locales/ui.zh-Hans.js site/locales/ui.en.js site/index.html scripts/check_country_incorporation_contract.mjs
git commit -m "feat: localize country incorporation map"
```

### Task 5: 浏览器验证与回归检查

**Files:**
- Create: `scripts/check_country_incorporation_browser.mjs`
- Modify: `scripts/check_country_incorporation_contract.mjs` only if a discovered contract needs a precise assertion

- [ ] **Step 1: 编写浏览器检查**

使用现有 Playwright 检查脚本的本地服务器入口，打开 `#/country`，断言整合年数按钮存在且禁用；点击一个国家卡片，断言按钮可用；点击按钮，断言 `countryIncorporationMapLegend` 可见、五个图例文本存在、地图模式状态为 `countryIncorporation`，并检查地图可见状态键数量等于完整地区数据数量而非筛选国家数量；清除选择后断言按钮禁用、图例隐藏、模式恢复 `country`。

- [ ] **Step 2: 运行浏览器测试**

运行 `node scripts/check_country_incorporation_browser.mjs`。预期输出 `country incorporation browser contract passed`，退出码 0。

- [ ] **Step 3: 运行完整相关回归**

依次运行：

```powershell
node scripts/check_country_incorporation_contract.mjs
node scripts/check_country_incorporation_browser.mjs
node scripts/check_two_level_navigation.mjs
node scripts/check_homepage_layout.mjs
node scripts/check_economy_board_contract.mjs
```

每个命令都必须退出 0；若出现失败，先修复对应回归再继续。

- [ ] **Step 4: 检查工作树并提交验证脚本**

运行 `git diff --check` 和 `git status --short --branch`，确认只包含本功能文件；提交浏览器测试脚本：

```powershell
git add scripts/check_country_incorporation_browser.mjs
git commit -m "test: verify country incorporation map"
```

- [ ] **Step 5: 输出独立工作树结果**

记录工作树路径、分支、提交列表、测试命令和实际退出结果；不合并、不推送、不修改主工作区未提交文件。
