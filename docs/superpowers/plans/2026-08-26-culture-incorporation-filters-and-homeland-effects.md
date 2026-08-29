# 文化整合计算器筛选与本土变化效果 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在文化整合计算器中加入按传承、语言、传统筛选并添加文化的功能，以及能覆写固定目标地域本土文化的效果勾选项。

**Architecture:** 抽取器从事件、日志和决议中收集 `add_homeland`、`remove_homeland`，为每项输出文化、固定地域、动态范围标记、来源和本地化键。生成的效果数据归入地域数据块；计算器在启动计算时把已勾选的固定效果叠加到地域开局本土文化，动态范围效果仅显示条件说明且不改写地图。筛选器复用已有文化的传承、语言和传统引用，不影响文化板块原有筛选状态。

**Tech Stack:** Node.js、现有 Clausewitz 解析器、原生 JavaScript、静态数据块、Node `assert` 契约脚本、无头 Chrome、Victorian Century 静态站点构建脚本。

---

### Task 1: 抽取并发布文化本土变化数据

**Files:**
- Modify: `scripts/extract_vic3_countries.mjs:5080-5235`
- Modify: `scripts/build_wiki.mjs:75-140, 330-420`
- Create: `scripts/check_culture_homeland_effects_data.mjs`
- Test data: `database/vic3_1.13.11/{events,journal_entries,decisions}.json`
- Test data: `database/victorian_century/{events,journal_entries,decisions}.json`

- [ ] **Step 1: 写出失败的数据契约**

创建 `scripts/check_culture_homeland_effects_data.mjs`。它读取数据库索引的 `culture_homeland_effects.json`，并要求每项包含：

```js
assert.deepEqual(Object.keys(effect).sort(), [
  "added_cultures", "content_id", "content_kind", "dynamic_scope",
  "eligible_when", "id", "localization_key", "removed_cultures",
  "source_file", "source_line", "state_regions",
].sort());
```

针对原版 1.13.11 断言：`manifest_destiny.1` 向加利福尼亚、内华达、犹他加入扬基本土，向亚利桑那、新墨西哥加入迪克西本土；`manifest_destiny.2` 向俄克拉何马加入迪克西本土、向蒙大拿至堪萨斯的七个固定地域加入扬基本土；`je_oregon` 是固定地域效果；`fsa_events.1` 与 `je_iberia` 标记 `dynamic_scope: true`。

针对 Victorian Century 断言：`joi_flavor_aus.10` 为伦巴第加入南德意志、移除北意大利；`joi_flavor_tur.52` 标记动态范围；`manifest_destiny_hawai` 向夏威夷群岛加入扬基本土；`expand_deutsche_reich_states_to_poland` 向五个固定地域加入北德意志本土。

- [ ] **Step 2: 运行失败数据契约**

运行：

```powershell
node scripts/check_culture_homeland_effects_data.mjs
```

预期因索引尚未输出 `culture_homeland_effects.json` 而失败。

- [ ] **Step 3: 在抽取器收集效果**

在 `scripts/extract_vic3_countries.mjs` 新增 `extractCultureHomelandEffects(contentCollections)`。`contentCollections` 接收已解析的事件、日志、决议记录，读取每条 `raw` 文本：

```js
const ADD_HOMELAND = /add_homeland\s*=\s*cu:([a-z0-9_]+)/g;
const REMOVE_HOMELAND = /remove_homeland\s*=\s*cu:([a-z0-9_]+)/g;
const STATE_REF = /s:(STATE_[A-Z0-9_]+)/g;
```

每条记录输出唯一 `id` 为 `${contentKind}:${content.id}`；`added_cultures`、`removed_cultures` 和 `state_regions` 去重排序。效果包含 `every_scope_state`、`every_state_in_iberia_old`、`capital.state_region`、`scope:` 或不能从文本解析出固定 `s:STATE_` 引用时，设置 `dynamic_scope: true`；仍保留能解析的固定地域。`eligible_when` 保存原始 `on_complete_raw`、`option` 或 `when_taken_raw` 的简短文本，不求解释游戏条件。

`localization_key` 使用内容记录的 `id`，使前端能显示内容键；没有已知本地化文本时显示内容 ID 与来源路径。不要把 `add_primary_culture`、`remove_primary_culture` 当成地域本土变化。

- [ ] **Step 4: 写入数据库索引和结构文件**

在 `originalFiles` 加入 `culture_homeland_effects`，在数据库 `index.files` 加入：

```js
culture_homeland_effects: "culture_homeland_effects.json",
```

并把总数写入 `index.counts.culture_homeland_effects`。确认本地化投影会保留 `localization_key` 字段。

- [ ] **Step 5: 运行抽取器和数据契约**

使用临时输出目录，避免改写主数据库：

```powershell
node scripts/extract_vic3_countries.mjs --game <vanilla-game-path> --out <temp-vanilla>
node scripts/extract_vic3_countries.mjs --game <vanilla-game-path> --mod <vc-mod-path> --out <temp-vc>
node scripts/check_culture_homeland_effects_data.mjs <temp-vanilla> <temp-vc>
```

预期输出 `culture homeland effects data passed`。

- [ ] **Step 6: 提交抽取与数据契约**

```powershell
git add scripts/extract_vic3_countries.mjs scripts/check_culture_homeland_effects_data.mjs
git commit -m "feat: extract culture homeland effects"
```

### Task 2: 将效果数据加入文化计算器的数据块

**Files:**
- Modify: `scripts/build_wiki.mjs:75-140, 250-420`
- Modify: `site/app/runtime.js:1-120, 250-280`
- Modify: `site/app/data.js:83-130`
- Modify: `scripts/check_culture_homeland_effects_data.mjs`
- Test: `scripts/check_culture_incorporation_calculator_contract.mjs`

- [ ] **Step 1: 写出失败站点数据契约**

扩展 `scripts/check_culture_homeland_effects_data.mjs`，读取生成的 `data-regions.js`，断言：

```js
assert.ok(Array.isArray(chunk.cultureHomelandEffects));
assert.ok(chunk.cultureHomelandEffects.some((effect) => effect.id === "event:manifest_destiny.1"));
```

扩展计算器契约，要求 `dataChunksForView("culture")` 加载效果所在数据块，且运行时存在：

```js
incorporationCalculatorHomelandEffects: new Set(),
```

- [ ] **Step 2: 运行失败站点数据契约**

```powershell
node scripts/check_culture_homeland_effects_data.mjs <temp-vanilla> <temp-vc>
node scripts/check_culture_incorporation_calculator_contract.mjs
```

预期因 `cultureHomelandEffects` 尚未进入 `build_wiki` 站点结构和运行时状态尚未定义而失败。

- [ ] **Step 3: 扩展 `build_wiki.mjs` 数据加载与地域块**

在 `loadSiteData()` 中读取 `sourceData.files.culture_homeland_effects`；在返回对象和 `wikiData` 中使用驼峰字段 `cultureHomelandEffects`。把它加入 `dataChunks.region`：

```js
region: ["stateRegions", "strategicRegions", "geographicRegions", "cultureHomelandEffects"],
```

不新增一个单独的网络数据块，确保文化路由已经加载地域数据时可以同步取得效果。

- [ ] **Step 4: 增加运行时效果状态**

在 `site/app/runtime.js` 增加：

```js
let cultureHomelandEffects = [];
// state 内：
incorporationCalculatorHomelandEffects: new Set(),
incorporationCalculatorFilterHeritageGroups: new Set(),
incorporationCalculatorFilterHeritages: new Set(),
incorporationCalculatorFilterLanguageGroups: new Set(),
incorporationCalculatorFilterLanguages: new Set(),
incorporationCalculatorFilterTradition: "",
```

在 `applyLoadedDataset()` 与相关映射函数中同步 `cultureHomelandEffects = data.cultureHomelandEffects || []`。清除计算器状态时清空全部计算器专用筛选状态和效果集合，不能清空文化板块原有 `heritages`、`languages`、`tradition`。

- [ ] **Step 5: 运行数据和加载检查**

```powershell
node scripts/build_wiki.mjs --database <temp-vanilla> --out <temp-site>
node scripts/check_culture_homeland_effects_data.mjs <temp-vanilla> <temp-vc> <temp-site>
node scripts/check_culture_incorporation_calculator_contract.mjs
```

预期全部退出码为 0。

- [ ] **Step 6: 提交地域块与运行时状态**

```powershell
git add scripts/build_wiki.mjs site/app/runtime.js site/app/data.js scripts/check_culture_homeland_effects_data.mjs scripts/check_culture_incorporation_calculator_contract.mjs
git commit -m "feat: load homeland effects for culture calculator"
```

### Task 3: 增加其他文化筛选与固定效果勾选界面

**Files:**
- Modify: `site/app/culture-incorporation.js:1-110`
- Modify: `site/styles/records.css:1690-1810`
- Modify: `site/locales/ui.zh-Hans.js`
- Modify: `site/locales/ui.en.js`
- Test: `scripts/check_culture_incorporation_calculator_contract.mjs`

- [ ] **Step 1: 写出失败界面契约**

扩展 `scripts/check_culture_incorporation_calculator_contract.mjs`，要求计算器模块包含：

```js
data-incorporation-filter-heritage-group
data-incorporation-filter-language-group
data-incorporation-filter-tradition
data-incorporation-filter-culture
data-incorporation-homeland-effect
data-incorporation-dynamic-effect
```

并断言不再出现 `data-incorporation-search`；高优先级候选区仍使用 `data-incorporation-candidate`。

- [ ] **Step 2: 运行失败界面契约**

```powershell
node scripts/check_culture_incorporation_calculator_contract.mjs
```

预期因新的筛选和效果数据属性尚未渲染而失败。

- [ ] **Step 3: 实现计算器专用文化筛选**

在 `culture-incorporation.js` 添加 `incorporationCalculatorFilteredCultures()`。筛选规则：传承组、传承、语言组、语言均为多选“交集”；传统为单选；命中后的文化按本地化名称排序。被选文化和高优先级候选文化从“其他文化”结果中剔除。

渲染顺序固定为：

1. 已选文化；
2. 可能涉及的文化：无搜索框，显示国家路径候选或当前资料库的少量默认候选；
3. 添加其他文化：传承、语言、传统筛选项和命中的可点击文化；
4. 文化本土变化：固定目标效果的复选框与变化摘要；
5. 动态范围效果：禁用的说明项，显示“范围取决于控制、整合或当前本土，未纳入计算”。

`incorporationCalculatorToggleFilter(kind, key)` 只修改计算器状态并重渲染侧栏；`incorporationCalculatorToggleCulture(key)` 同时适用于候选和筛选结果。没有选择筛选条件时，“其他文化”不显示全量列表，只显示筛选说明，避免数百项文化直接出现。

- [ ] **Step 4: 实现效果分类与勾选**

加入：

```js
function incorporationCalculatorFixedHomelandEffects() {
  return cultureHomelandEffects.filter((effect) => !effect.dynamic_scope && effect.state_regions.length);
}

function incorporationCalculatorDynamicHomelandEffects() {
  return cultureHomelandEffects.filter((effect) => effect.dynamic_scope);
}
```

效果显示来源内容 ID、增加/删除文化和固定地域数量；使用本地化键没有翻译时显示内容 ID。点击固定效果只修改 `state.incorporationCalculatorHomelandEffects`，不即时为地图着色，仍由“开始计算”统一应用。动态项无可点击复选框。

- [ ] **Step 5: 添加双语词条和响应式样式**

添加词条：

```js
"board.culture.incorporation.otherCultures"
"board.culture.incorporation.filterHeritage"
"board.culture.incorporation.filterLanguage"
"board.culture.incorporation.filterTradition"
"board.culture.incorporation.noFilter"
"board.culture.incorporation.homelandEffects"
"board.culture.incorporation.dynamicEffects"
"board.culture.incorporation.dynamicEffectNote"
"board.culture.incorporation.addedHomeland"
"board.culture.incorporation.removedHomeland"
"board.culture.incorporation.fixedRegions"
```

在 `records.css` 中让筛选按钮、文化结果、效果复选项在 442 像素宽度下换行；高优先级候选区不放入可滚动搜索框。

- [ ] **Step 6: 运行界面契约和语法检查**

```powershell
node scripts/check_culture_incorporation_calculator_contract.mjs
node --check site/app/culture-incorporation.js
```

预期输出 `culture incorporation calculator contract passed`。

- [ ] **Step 7: 提交筛选与效果侧栏**

```powershell
git add site/app/culture-incorporation.js site/styles/records.css site/locales/ui.zh-Hans.js site/locales/ui.en.js scripts/check_culture_incorporation_calculator_contract.mjs
git commit -m "feat: filter cultures and select homeland effects"
```

### Task 4: 在计算中叠加固定地域本土变化

**Files:**
- Modify: `site/app/map.js:279-320, 475-570, 1990-2010`
- Modify: `site/app/culture-incorporation.js`
- Test: `scripts/check_culture_incorporation_calculator_contract.mjs`
- Test: `scripts/check_culture_incorporation_calculator_browser.mjs`

- [ ] **Step 1: 写出失败地图契约**

在计算器契约中要求：

```js
assert.match(map, /function incorporationCalculatorHomelandCulturesForStateRegion\(/);
assert.match(map, /incorporationCalculatorHomelandEffects/);
assert.match(map, /state\.mapMode === "cultureIncorporation"[\s\S]*incorporationCalculatorHomelandEffects/);
```

并使用独立纯函数验证：输入 `STATE_CALIFORNIA` 的开局本土与 `event:manifest_destiny.1` 后，扬基在结果中；输入 `STATE_SAVOY` 和法国吞并萨伏依效果后，北意大利不在结果中。

- [ ] **Step 2: 运行失败地图契约**

```powershell
node scripts/check_culture_incorporation_calculator_contract.mjs
```

预期因本土覆写函数和缓存签名尚未实现而失败。

- [ ] **Step 3: 实现只读本土覆写函数**

在 `map.js` 增加：

```js
function incorporationCalculatorHomelandCulturesForStateRegion(stateRegion) {
  const homelandKeys = new Set((stateRegion.homeland_cultures || []).map((culture) => culture.key));
  const selectedEffects = new Set(state.incorporationCalculatorHomelandEffects);
  for (const effect of cultureHomelandEffects) {
    if (effect.dynamic_scope || !selectedEffects.has(effect.id) || !effect.state_regions.includes(stateRegion.key)) continue;
    for (const key of effect.removed_cultures || []) homelandKeys.delete(key);
    for (const key of effect.added_cultures || []) homelandKeys.add(key);
  }
  return [...homelandKeys].map((key) => byCulture.get(key) || { key });
}
```

将 `countryIncorporationForStateRegion` 扩展为第四参数 `homelandCultureOverride = null`。文化计算器地图传入覆写本土，国家基础地图保持 `null`。地图提示中的“本土文化”也显示覆写后的结果。

- [ ] **Step 4: 缓存签名包含已应用效果**

在 `mapLayerSignature()` 的 `cultureIncorporation` 分支加入：

```js
parts.push(`homelandEffects:${setSignature(state.incorporationCalculatorHomelandEffects)}`);
```

计算器中新增 `incorporationCalculatorAppliedHomelandEffects`，点击“开始计算”才从勾选集合复制到应用集合；地图函数和签名读取应用集合。此规则与文化集合相同，确保修改勾选状态不会即时更新颜色。

- [ ] **Step 5: 运行地图契约**

```powershell
node scripts/check_culture_incorporation_calculator_contract.mjs
node scripts/check_country_incorporation_contract.mjs
node --check site/app/map.js
```

预期全部退出码为 0。

- [ ] **Step 6: 提交地图叠加逻辑**

```powershell
git add site/app/map.js site/app/culture-incorporation.js site/app/runtime.js scripts/check_culture_incorporation_calculator_contract.mjs
git commit -m "feat: apply homeland effects to incorporation map"
```

### Task 5: 重建三套站点并验证交互

**Files:**
- Modify generated data: `site/versions/1.13.11/data-regions.js`, `site/versions/1.13.11/data-index.js`
- Modify ignored check copies: `Victorian Century Database/**`, `site/vc/**`
- Modify: `scripts/check_culture_incorporation_calculator_browser.mjs`
- Modify: `docs/worklog/2026-08-25-culture-incorporation-calculator.md`

- [ ] **Step 1: 写出失败浏览器检查**

扩展浏览器脚本：打开 `#/culture/incorporation`，断言没有 `[data-incorporation-search]`；选择传承或语言筛选后，`[data-incorporation-filter-culture]` 出现；点击其中一个文化后进入已选集合。断言固定项 `event:manifest_destiny.1` 有可点击复选框，`event:fsa_events.1` 仅作为 `[data-incorporation-dynamic-effect]` 出现。

选择扬基并勾选昭昭天命第一阶段，点击“开始计算”后，读取加州的地图特征并断言命中文化为扬基、整合年数为 2。取消勾选但不启动，断言已应用效果集合和加州图层保持原值；再次启动后，效果被移除。对 VC 断言奥地利伦巴第效果存在且可选。

- [ ] **Step 2: 运行失败浏览器检查**

```powershell
node scripts/check_culture_incorporation_calculator_browser.mjs <vanilla-url> <vc-url> <site-vc-url>
```

预期因筛选区和效果复选项尚未实现而失败。

- [ ] **Step 3: 重建原版和 Victorian Century 站点**

使用本轮生成的数据库构件运行：

```powershell
node scripts/build_wiki.mjs --database database/vic3_1.13.11 --out site/versions/1.13.11
node scripts/build_wiki.mjs --database database/victorian_century --baseline-database database/vic3_1.13.11 --out "Victorian Century Database"
node scripts/build_victorian_century_site.mjs --source site --target "Victorian Century Database" --publish-target site/vc --vc-database database/victorian_century --skip-vc-assets
```

如果当前工作树不含完整可重建数据库，使用已验证的临时数据库副本，并在工作记录注明实际路径；不要修改游戏或模组原始文件。

- [ ] **Step 4: 运行全量检查**

```powershell
node scripts/check_culture_homeland_effects_data.mjs database/vic3_1.13.11 database/victorian_century
node scripts/check_culture_incorporation_calculator_contract.mjs
node scripts/check_culture_incorporation_calculator_browser.mjs <vanilla-url> <vc-url> <site-vc-url>
node scripts/check_country_incorporation_contract.mjs
node scripts/check_primary_culture_expansion_data.mjs
node scripts/check_multilingual_board_contracts.mjs
git diff --check
```

预期全部退出码为 0。浏览器检查须覆盖原版、Victorian Century 独立站与 `site/vc`，并在 442×844 检查没有横向溢出。

- [ ] **Step 5: 记录并提交**

更新 `docs/worklog/2026-08-25-culture-incorporation-calculator.md`，记录固定本土变化已能参与计算、动态范围效果仅作说明，列明数据契约与浏览器验证。只提交跟踪的源代码、测试和工作记录；不强制加入忽略的 Victorian Century 检查副本与 `site/vc`。

```powershell
git add scripts/check_culture_homeland_effects_data.mjs scripts/check_culture_incorporation_calculator_browser.mjs docs/worklog/2026-08-25-culture-incorporation-calculator.md
git commit -m "test: verify culture homeland effect calculator"
```
