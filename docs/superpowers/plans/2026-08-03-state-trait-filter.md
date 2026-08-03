# 地区特质筛选实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在地域板块增加“地区特质”多选筛选，以六个平级选项驱动地区特质视图、地域列表过滤、地图灰显和图标明暗，并把地图及悬停提示图标统一调整为 38 像素。

**Architecture:** 在现有全局状态中增加一个地区特质筛选键集合，由 `filters.js` 负责结构化分类和地域匹配，`ui.js` 负责“所有”互斥、具体分类多选及地形视图互斥。`map.js` 根据筛选集合切换地区特质模式，在每个地图特征中同时保存完整特质与命中特质，保证悬停提示完整、图标只绘制一次，并在绘制时应用 1、0.18 和既有灰显三档不透明度。

**Tech Stack:** 原生 JavaScript、Canvas 2D、CSS、Node.js 静态检查、Playwright 浏览器回归。

---

## 文件结构

- `site/app/runtime.js`：保存筛选选项定义、`state.stateTraitFilters` 与筛选容器引用。
- `site/app/filters.js`：把结构化特质字段映射到筛选键，执行“或”匹配并渲染筛选令牌。
- `site/app/ui.js`：处理“所有”互斥、具体分类多选、地形视图互斥、全局重置和板块切换。
- `site/app/components.js`：在当前筛选摘要中显示地区特质筛选状态。
- `site/app/map.js`：根据筛选状态选择地图模式，构建完整特质及命中特质集合，处理地图灰显、图标透明度和 38 像素绘制。
- `site/index.html`：新增“地区特质”筛选区，移除独立的地区特质视图按钮，并更新脚本与样式缓存键。
- `site/styles/map.css`、`site/styles.css`：将悬停提示图标改为 38 像素并更新样式缓存键。
- `scripts/check_state_trait_map.mjs`：验证分类数据、状态、互斥逻辑、地图数据流、尺寸和缓存键。
- `scripts/check_state_trait_map_browser.mjs`：验证原版、Victorian Century、窄屏以及实际绘制透明度与尺寸。
- `scripts/check_province_terrain_map.mjs`、`scripts/check_region_map_interaction.mjs`、`scripts/check_resource_map_colors.mjs`：同步更新共用脚本和样式的缓存键断言。
- `docs/worklog/2026-08-03-state-trait-map.md`：补充筛选功能与验证记录。

### Task 1: 写入分类与筛选语义的失败测试

**Files:**
- Modify: `scripts/check_state_trait_map.mjs`

- [ ] **Step 1: 为静态检查增加筛选模块和标准数据样本。**

在文件顶部增加 `node:vm`、筛选源码和四个已知特质：

```js
import vm from "node:vm";

const filtersSource = readText("site/app/filters.js");
const ishikariWetlands = uniqueTraits.find((trait) => trait.key === "state_trait_ishikari_wetlands_1");
const nileRiver = uniqueTraits.find((trait) => trait.key === "state_trait_nile_river");
const malaria = uniqueTraits.find((trait) => trait.key === "state_trait_malaria");
const severeMalaria = uniqueTraits.find((trait) => trait.key === "state_trait_severe_malaria");

for (const [label, trait] of Object.entries({ ishikariWetlands, nileRiver, malaria, severeMalaria })) {
  assert.ok(trait, `main data should contain ${label}`);
}
```

- [ ] **Step 2: 加入可执行的分类函数测试，锁定多分类、MAPI、殖民环境和“或”匹配。**

将实现中的两个函数提取到隔离上下文后断言：

```js
const traitFilterContext = {
  state: { stateTraitFilters: new Set() },
  Set,
};
vm.runInNewContext(`
  ${functionSource(filtersSource, "stateTraitFilterKeys")}
  ${functionSource(filtersSource, "stateTraitMatchesSelectedFilters")}
  this.stateTraitFilterKeys = stateTraitFilterKeys;
  this.stateTraitMatchesSelectedFilters = stateTraitMatchesSelectedFilters;
`, traitFilterContext);

assert.deepEqual(
  [...traitFilterContext.stateTraitFilterKeys(ishikariWetlands)].sort(),
  ["land", "resources", "waterways"],
  "Ishikari wetlands should retain all three overlapping categories",
);
assert.deepEqual(
  [...traitFilterContext.stateTraitFilterKeys(nileRiver)].sort(),
  ["land", "mapi", "waterways"],
  "Nile should combine water, land and MAPI",
);
assert.deepEqual(
  [...traitFilterContext.stateTraitFilterKeys(malaria)],
  ["colonial_environment"],
  "malaria should use its disabling technology as colonial environment evidence",
);
assert.deepEqual(
  [...traitFilterContext.stateTraitFilterKeys(severeMalaria)],
  ["colonial_environment"],
  "severe malaria should use its colonization and disabling technologies",
);
assert.deepEqual([...traitFilterContext.stateTraitFilterKeys({})], [], "missing optional fields should produce no specific categories");

traitFilterContext.state.stateTraitFilters = new Set(["waterways", "resources"]);
assert.equal(traitFilterContext.stateTraitMatchesSelectedFilters(ishikariWetlands), true, "specific categories should use OR matching");
assert.equal(traitFilterContext.stateTraitMatchesSelectedFilters(malaria), false, "unselected categories should not match");
traitFilterContext.state.stateTraitFilters = new Set(["all"]);
assert.equal(traitFilterContext.stateTraitMatchesSelectedFilters(malaria), true, "all should match every trait");
```

- [ ] **Step 3: 对原版与 Victorian Century 做分类覆盖检查。**

在加载 Victorian Century 数据后增加：

```js
for (const [label, rows] of [["main", states], ["Victorian Century", victorianCenturyStates]]) {
  if (!rows) continue;
  const traits = [...new Map(rows.flatMap((region) => region.traits || []).map((trait) => [trait.key, trait])).values()];
  const uncovered = traits.filter((trait) => traitFilterContext.stateTraitFilterKeys(trait).size === 0);
  assert.deepEqual(uncovered.map((trait) => trait.key), [], `${label} traits should all reach at least one specific filter`);
}
```

- [ ] **Step 4: 运行测试并确认其因分类函数尚未存在而失败。**

Run:

```powershell
$env:VICDATA_DATA_ROOT='D:\Bot\Vic3\Victoria3_DB'
$env:VICDATA_VC_DATA_ROOT='D:\Bot\Vic3\Victoria3_DB'
node scripts/check_state_trait_map.mjs
```

Expected: FAIL，错误指向 `stateTraitFilterKeys` 或 `stateTraitMatchesSelectedFilters` 未找到。

### Task 2: 实现筛选状态、分类和地域列表过滤

**Files:**
- Modify: `site/app/runtime.js:130-145, 405-510, 720-760`
- Modify: `site/app/filters.js:40-52, 175-225, 520-535`
- Modify: `scripts/check_state_trait_map.mjs`

- [ ] **Step 1: 在运行时状态中增加稳定选项与筛选集合。**

在筛选常量区定义：

```js
const stateTraitFilterOptions = [
  { key: "all", label: "所有" },
  { key: "waterways", label: "河流海港" },
  { key: "land", label: "土壤地貌" },
  { key: "resources", label: "自然资源" },
  { key: "colonial_environment", label: "殖民环境" },
  { key: "mapi", label: "MAPI" },
];
```

在 `state` 中增加：

```js
stateTraitFilters: new Set(),
```

在 `els` 中增加：

```js
stateTraitFilters: document.querySelector("#stateTraitFilters"),
```

- [ ] **Step 2: 在筛选模块实现结构化分类函数。**

将以下函数放在 `matchesResourceFilters` 之前：

```js
function stateTraitFilterKeys(trait) {
  const categories = new Set((trait?.categories || []).map((category) => category?.key).filter(Boolean));
  const keys = new Set();
  if (categories.has("river") || categories.has("port")) keys.add("waterways");
  if (categories.has("agriculture") || categories.has("terrain_climate")) keys.add("land");
  if (categories.has("resource")) keys.add("resources");
  if ((trait?.required_techs_for_colonization || []).length || (trait?.disabling_technologies || []).length) {
    keys.add("colonial_environment");
  }
  if (trait?.has_mapi) keys.add("mapi");
  return keys;
}

function stateTraitMatchesSelectedFilters(trait) {
  if (state.stateTraitFilters.has("all")) return true;
  const keys = stateTraitFilterKeys(trait);
  return [...state.stateTraitFilters].some((key) => keys.has(key));
}

function matchingStateTraits(stateRegion) {
  if (state.stateTraitFilters.size === 0) return [];
  return (stateRegion?.traits || []).filter(stateTraitMatchesSelectedFilters);
}

function matchesStateTraitFilters(stateRegion) {
  if (state.stateTraitFilters.size === 0) return true;
  return matchingStateTraits(stateRegion).length > 0;
}
```

- [ ] **Step 3: 把地区特质条件接入地域过滤。**

在 `matchesStateRegionFilters` 的资源判断之后、文本搜索之前加入：

```js
if (!matchesStateTraitFilters(stateRegion)) return false;
```

这会让“所有”只保留含特质地域，让具体分类只保留至少含一个命中特质的地域，并与现有资源、战略区域、地理区域和搜索条件共同生效。

- [ ] **Step 4: 实现筛选令牌渲染。**

在 `renderResourceFilterOptions` 后增加：

```js
function renderStateTraitFilterOptions() {
  if (!els.stateTraitFilters) return;
  syncSetWithOptions(state.stateTraitFilters, stateTraitFilterOptions);
  els.stateTraitFilters.innerHTML = stateTraitFilterOptions.map((option) => (
    optionToken("state-trait-filter", option.key, option.label, state.stateTraitFilters.has(option.key))
  )).join("");
}
```

- [ ] **Step 5: 运行分类测试并确认通过。**

Run:

```powershell
node scripts/check_state_trait_map.mjs
```

Expected: 分类、多重归类、MAPI、殖民环境和两套数据覆盖断言均 PASS，脚本输出 `"state_trait_map": "ok"`。

- [ ] **Step 6: 提交分类与数据层。**

```powershell
git add site/app/runtime.js site/app/filters.js scripts/check_state_trait_map.mjs
git commit -m "feat: classify and filter state traits"
```

### Task 3: 用筛选类别取代独立视图按钮

**Files:**
- Modify: `scripts/check_state_trait_map.mjs`
- Modify: `site/index.html:103-118, 300-318`
- Modify: `site/app/runtime.js:745-760`
- Modify: `site/app/ui.js:225-300, 315-345, 1335-1460`
- Modify: `site/app/map.js:1-110`
- Modify: `site/app/components.js:2667-2710`
- Modify: `scripts/check_region_map_interaction.mjs`
- Modify: `scripts/check_resource_map_colors.mjs`
- Modify: `scripts/check_province_terrain_map.mjs`

- [ ] **Step 1: 把静态断言改为新的筛选入口和状态切换契约。**

删除对 `stateTraitMapViewButton` 的断言，增加：

```js
assert.ok(/<summary>地区特质<\/summary>[\s\S]*id="stateTraitFilters"/.test(indexSource), "region filters should expose a state-trait filter section");
assert.doesNotMatch(indexSource, /id="stateTraitMapViewButton"/, "the standalone trait-view button should be removed");
assert.ok(/stateTraitFilters:\s*new Set\(\)/.test(runtimeSource), "runtime should store selected state-trait filters");
assert.ok(/stateTraitFilters:\s*document\.querySelector\("#stateTraitFilters"\)/.test(runtimeSource), "runtime should expose the filter container");
for (const label of ["所有", "河流海港", "土壤地貌", "自然资源", "殖民环境", "MAPI"]) {
  assert.ok(runtimeSource.includes(`label: "${label}"`), `state-trait filters should expose ${label}`);
}
assert.ok(/value === "all"[\s\S]*state\.stateTraitFilters\.clear\(\)/.test(functionSource(uiSource, "bindStateTraitFilterTokens")), "all should be mutually exclusive");
assert.ok(/state\.stateTraitFilters\.delete\("all"\)/.test(functionSource(uiSource, "bindStateTraitFilterTokens")), "specific categories should clear all");
const bindEventsSource = functionSource(uiSource, "bindEvents");
assert.ok((bindEventsSource.match(/state\.stateTraitFilters\.clear\(\)/g) || []).length >= 2, "reset and terrain view should both clear trait filters");
assert.ok(/state\.view === "region" && state\.stateTraitFilters\.size > 0[\s\S]*state\.mapMode = "traitIcons"/.test(functionSource(mapSource, "syncMapModeForView")), "selected trait filters should drive trait icon mode");
assert.ok(/state\.view === "region" && state\.stateTraitFilters\.size/.test(functionSource(readText("site/app/components.js"), "buildActiveHint")), "active filter summary should include state-trait filters");
```

- [ ] **Step 2: 运行静态检查并确认旧界面不满足新契约。**

Run: `node scripts/check_state_trait_map.mjs`

Expected: FAIL，错误指向缺少 `#stateTraitFilters` 或仍存在 `#stateTraitMapViewButton`。

- [ ] **Step 3: 在筛选栏加入地区特质类别并移除旧按钮。**

在资源筛选与地图筛选之间加入：

```html
<details class="filter-section region-only">
  <summary>地区特质</summary>
  <div id="stateTraitFilters" class="option-list"></div>
</details>
```

地图筛选中仅保留：

```html
<button id="terrainMapViewButton" class="filter-token" type="button" aria-pressed="false">地形视图</button>
```

同时从 `runtime.js` 的 `els` 对象删除：

```js
stateTraitMapViewButton: document.querySelector("#stateTraitMapViewButton"),
```

- [ ] **Step 4: 实现筛选令牌的互斥和多选事件。**

在 `bindEvents` 中调用 `bindStateTraitFilterTokens()`，并增加：

```js
function bindStateTraitFilterTokens() {
  els.stateTraitFilters?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-state-trait-filter]");
    if (!button || !els.stateTraitFilters.contains(button)) return;
    const value = button.dataset.stateTraitFilter;
    const pressed = button.getAttribute("aria-pressed") === "true";
    if (value === "all") {
      state.stateTraitFilters.clear();
      if (!pressed) state.stateTraitFilters.add("all");
    } else {
      state.stateTraitFilters.delete("all");
      toggleSet(state.stateTraitFilters, value, !pressed);
    }
    if (state.stateTraitFilters.size > 0) state.regionMapView = "default";
    state.mapSubject = "";
    render();
  });
}
```

- [ ] **Step 5: 修改地形视图和全局重置。**

把地形按钮处理改为：

```js
els.terrainMapViewButton?.addEventListener("click", () => {
  const enableTerrain = state.regionMapView !== "terrain";
  state.regionMapView = enableTerrain ? "terrain" : "default";
  if (enableTerrain) state.stateTraitFilters.clear();
  state.mapSubject = "";
  render();
});
```

删除旧地区特质按钮监听，并在 `resetButton` 处理中加入：

```js
state.stateTraitFilters.clear();
```

- [ ] **Step 6: 在每次渲染时同步令牌和筛选区展开状态。**

在 `render()` 的筛选选项调用序列中加入：

```js
renderStateTraitFilterOptions();
```

在 `syncFilterSectionOpenStates` 中加入：

```js
setSection(".filter-section:has(#stateTraitFilters)", state.stateTraitFilters.size > 0);
```

不要把 `stateTraitFilters` 加入默认展开集合，使该类别初始保持折叠，选中后自动展开。

在 `buildActiveHint` 的地域资源摘要之后加入：

```js
if (state.view === "region" && state.stateTraitFilters.size) {
  parts.push(`地区特质 ${state.stateTraitFilters.has("all") ? "所有" : state.stateTraitFilters.size}`);
}
```

- [ ] **Step 7: 让筛选集合直接驱动地图模式。**

删除 `renderMapControls` 对旧按钮的同步，在 `syncMapModeForView` 中用以下分支替代 `regionMapView === "traits"`：

```js
if (state.view === "region" && state.stateTraitFilters.size > 0) {
  state.mapMode = "traitIcons";
  state.mapSubject = "";
  return;
}
```

离开地域板块时仍只重置 `regionMapView`，不要清空 `stateTraitFilters`；返回地域板块后上述分支会恢复地区特质视图。

- [ ] **Step 8: 更新变更文件的缓存键及相关测试。**

主入口及四个已修改脚本统一使用 `20260803-state-trait-filter1`：

```html
<link rel="stylesheet" href="styles.css?v=20260803-state-trait-filter1">
<script src="app/runtime.js?v=20260803-state-trait-filter1"></script>
<script src="app/ui.js?v=20260803-state-trait-filter1"></script>
<script src="app/filters.js?v=20260803-state-trait-filter1"></script>
<script src="app/map.js?v=20260803-state-trait-filter1"></script>
<script src="app/components.js?v=20260803-state-trait-filter1"></script>
```

`data.js` 保留现有缓存键。此任务只更新 `site/index.html` 中 `styles.css` 的查询参数，不修改 `site/styles.css` 内部的 `map.css` 查询参数；后者随下一任务的实际样式修改一并更新。同步调整 `check_state_trait_map.mjs`、`check_region_map_interaction.mjs`、`check_resource_map_colors.mjs` 和 `check_province_terrain_map.mjs` 中对应断言。

- [ ] **Step 9: 运行界面静态测试并提交。**

Run:

```powershell
node scripts/check_state_trait_map.mjs
node scripts/check_region_map_interaction.mjs
```

Expected: 两项均输出 `ok` JSON，且无断言失败。

Commit:

```powershell
git add site/index.html site/app/runtime.js site/app/ui.js site/app/map.js site/app/components.js scripts/check_state_trait_map.mjs scripts/check_region_map_interaction.mjs scripts/check_resource_map_colors.mjs scripts/check_province_terrain_map.mjs
git commit -m "feat: drive trait view from filters"
```

### Task 4: 实现完整图标、命中图标与三档明暗

**Files:**
- Modify: `scripts/check_state_trait_map.mjs`
- Modify: `scripts/check_state_trait_map_browser.mjs`
- Modify: `site/index.html:300-318`
- Modify: `site/app/map.js:210-250, 418-435, 685-710, 1508-1535`
- Modify: `site/app/presentation.js:358-445`
- Modify: `site/styles/map.css:171-186`
- Modify: `site/styles.css:1-5`

- [ ] **Step 1: 将静态尺寸和特征结构断言更新为新契约。**

在 `check_state_trait_map.mjs` 中要求：

```js
assert.ok(/traits:\s*traits/.test(functionSource(mapSource, "buildTraitIconMapFeatures")), "trait features should retain every trait for drawing and tooltips");
assert.ok(/matchingTraits/.test(functionSource(mapSource, "buildTraitIconMapFeatures")), "trait features should retain the selected subset");
assert.ok(/stateTraitFilters/.test(functionSource(mapSource, "mapLayerSignature")), "trait filters should invalidate cached map layers");
assert.ok(/state\.stateTraitFilters\.size > 0/.test(functionSource(mapSource, "regionMapStateRegions")), "trait filters should constrain visible map regions");
assert.ok(/state\.stateTraitFilters\.size === 0/.test(functionSource(readText("site/app/presentation.js"), "renderRegionList")), "filtered map selections should not be reinserted into a trait-filtered list");
assert.ok(/app\/presentation\.js\?v=20260803-state-trait-filter1/.test(indexSource), "changed presentation code should use the state-trait filter cache key");
assert.ok(/const iconSize = 38;/.test(functionSource(mapSource, "drawStateTraitMapIcons")), "map trait icons should use 38 pixels");
assert.ok(/0\.18/.test(functionSource(mapSource, "drawStateTraitMapIcons")), "nonmatching icons in a matching region should use 0.18 opacity");
assert.ok(/loadImage\([\s\S]*\.catch\(\(\) => null\)/.test(functionSource(mapSource, "loadStateTraitIconImages")), "a missing icon should not abort other icon loads");
assert.ok(/if \(!image\) continue;/.test(functionSource(mapSource, "drawStateTraitMapIcons")), "a missing icon should skip only its own draw call");
assert.ok(/\.map-tooltip-trait-icon\s*\{[\s\S]*width:\s*38px;[\s\S]*height:\s*38px;/.test(readText("site/styles/map.css")), "tooltip icons should use 38 pixels");
```

- [ ] **Step 2: 先把浏览器测试改为通过“所有”筛选进入视图，并期待 38 像素。**

将 `openTraitView` 的点击目标改为：

```js
await page.locator("[data-state-trait-filter='all']").click();
await page.waitForFunction(() => window.eval("state.mapMode") === "traitIcons" && window.eval("mapRuntime.ready"), { timeout: 30000 });
```

由于地区特质类别初始折叠，在点击令牌前通过真实的 `summary` 交互展开：

```js
const traitFilterSection = page.locator(".filter-section:has(#stateTraitFilters)");
if ((await traitFilterSection.getAttribute("open")) === null) {
  await traitFilterSection.locator("summary").click();
}
```

返回值增加：

```js
selectedFilters: [...window.eval("state.stateTraitFilters")],
listCount: document.querySelectorAll("[data-state-region]").length,
visibleStateCount: window.eval("mapRuntime.visibleStateKeys.size"),
```

删除旧按钮专属的 `pressed` 和 `view` 返回字段，并用以下断言取代 `initial.pressed` 与 `initial.view`：

```js
assert.deepEqual(initial.selectedFilters, ["all"], "all should be the only selected state-trait filter");
assert.equal(initial.mode, "traitIcons", "state-trait filters should select trait icon mode");
```

把地图宽度、间距及悬停提示宽高预期从 30 改为 38。

- [ ] **Step 3: 增加“所有”、具体分类多选和图标透明度的浏览器断言。**

在主站测试中依次验证：

```js
assert.deepEqual(initial.selectedFilters, ["all"], "all should be the only initial trait filter");
const expectedAllCount = await main.evaluate(() => window.eval("landStateRegions").filter((region) => (region.traits || []).length > 0).length);
assert.equal(initial.listCount, expectedAllCount, "all should list every trait-bearing land region");
assert.equal(initial.visibleStateCount, initial.listCount, "all should gray every region without traits or excluded by other filters");
const mainLayout = await traitIconLayout(main);
assert.equal(mainLayout.iconCount, mainLayout.traitCount, "overlapping category membership must not duplicate icons");

await main.locator("[data-state-trait-filter='waterways']").click();
await main.locator("[data-state-trait-filter='resources']").click();
const unionState = await main.evaluate(() => ({
  selected: [...window.eval("state.stateTraitFilters")].sort(),
  listed: document.querySelectorAll("[data-state-region]").length,
  expected: window.eval("landStateRegions").filter(window.eval("matchesStateTraitFilters")).length,
}));
assert.deepEqual(unionState.selected, ["resources", "waterways"], "specific filters should replace all and combine by OR");
assert.equal(unionState.listed, unionState.expected, "list results should use the same trait predicate");
```

在 `traitIconLayout` 的返回对象中加入：

```js
traitCount: entry[1].traits.length,
```

扩充 `traitIconLayout` 使用带读取器的 `globalAlpha` 模拟属性：

```js
let alpha = 1;
drawStateTraitMapIcons({
  save() {},
  restore() {},
  drawImage(image, x, y, width, height) { calls.push({ x, y, width, height, alpha }); },
  set globalAlpha(value) { alpha = value; },
  get globalAlpha() { return alpha; },
}, { start: 0, end: 0 }, runtime.transform);
```

增加一个接受特征选择条件的辅助函数，分别抽取混合地域和灰显地域：

```js
async function traitIconAlphas(page, featureKind) {
  return page.evaluate((kind) => {
    const runtime = window.eval("mapRuntime");
    const drawStateTraitMapIcons = window.eval("drawStateTraitMapIcons");
    const entry = [...runtime.featureByStateKey].find(([stateKey, feature]) => {
      if (!(feature.traits || []).length) return false;
      if (kind === "mixed") return runtime.visibleStateKeys.has(stateKey)
        && feature.matchingTraits.length > 0
        && feature.matchingTraits.length < feature.traits.length;
      return !runtime.visibleStateKeys.has(stateKey);
    });
    if (!entry) return [];
    const originalFeatures = runtime.featureByStateKey;
    const calls = [];
    let alpha = 1;
    runtime.featureByStateKey = new Map([entry]);
    try {
      drawStateTraitMapIcons({
        save() {},
        restore() {},
        drawImage(image, x, y, width, height) { calls.push({ alpha, width, height }); },
        set globalAlpha(value) { alpha = value; },
        get globalAlpha() { return alpha; },
      }, { start: 0, end: 0 }, runtime.transform);
    } finally {
      runtime.featureByStateKey = originalFeatures;
    }
    return calls.map((call) => call.alpha);
  }, featureKind);
}
```

断言：

```js
const mixedAlphas = await traitIconAlphas(main, "mixed");
assert(mixedAlphas.includes(1), "matching icons should remain fully opaque");
assert(mixedAlphas.includes(0.18), "nonmatching icons in a matching region should use 0.18 opacity");
const mutedAlphas = await traitIconAlphas(main, "muted");
assert(mutedAlphas.length > 0 && mutedAlphas.every((alpha) => alpha === 0.36), "filtered-out regions should retain the existing muted icon opacity");
```

- [ ] **Step 4: 运行静态测试并确认旧地图结构与 30 像素尺寸导致失败。**

Run: `node scripts/check_state_trait_map.mjs`

Expected: FAIL，错误指向缺少 `matchingTraits`、缺少 0.18 或仍为 30 像素。

- [ ] **Step 5: 让地图特征同时保存完整特质和命中特质。**

将 `buildTraitIconMapFeatures` 改为：

```js
function buildTraitIconMapFeatures() {
  const features = new Map();
  for (const stateRegion of stateRegions) {
    const traits = stateRegion.traits || [];
    const matchingTraits = matchingStateTraits(stateRegion);
    const isSea = isSeaStateRegion(stateRegion);
    features.set(stateRegion.key, {
      color: mapFeatureColor(stateRegion, isSea ? MAP_SEA_COLOR : "#eee9df"),
      active: matchingTraits.length > 0,
      value: matchingTraits.length,
      traits,
      matchingTraits,
    });
  }
  return features;
}
```

- [ ] **Step 6: 将筛选集合加入地图缓存签名。**

在 `mapLayerSignature` 的基础数组中加入：

```js
`stateTraits:${setSignature(state.stateTraitFilters)}`,
```

这样从一个分类切到另一个分类时不会复用旧的 `matchingTraits`。

- [ ] **Step 7: 让地区特质筛选约束地图可见地域且不被已选地域覆盖。**

在 `regionMapStateRegions` 的开头先处理地区特质筛选，使所有匹配地域保持正常底色，不让单击选择把可见集合缩减为一个地域：

```js
if (state.stateTraitFilters.size > 0) return filteredStateRegions;
```

随后保留现有选中地域、地理区域和资源筛选分支；通用筛选分支维持：

```js
if (state.resourceFilters.size > 0 || state.strategicRegions.size > 0) {
  return [...filteredStateRegions, ...filteredSeaStateRegions];
}
```

- [ ] **Step 8: 阻止地图选中的灰显地域重新插入筛选结果列表。**

在 `renderRegionList` 中把特殊地图选中卡片限制为没有启用地区特质筛选时才显示：

```js
const selectedFromMapHtml = mapSelectionIsFilteredOut && state.stateTraitFilters.size === 0
  ? stateRegionRowHtml(selectedStateRegionFromMap, { mapSelected: true })
  : "";
```

在 `syncMapSelectedStateRegionCard` 中增加同样的保护，避免点击灰显地域后立即插入一张不符合筛选条件的卡片：

```js
const filteredOutByTraitView = state.stateTraitFilters.size > 0 && !matchesStateRegionFilters(selected);
if (!selected || visible || filteredOutByTraitView) return;
```

- [ ] **Step 9: 实现 38 像素单行绘制和分级透明度。**

将 `drawStateTraitMapIcons` 的核心循环改为：

```js
const iconSize = 38;
const inverseScale = 1 / Math.max(transform.scale, 0.001);
const mapIconSize = iconSize * inverseScale;
const specificFiltersActive = state.stateTraitFilters.size > 0 && !state.stateTraitFilters.has("all");
context.save();
for (const [stateKey, feature] of mapRuntime.featureByStateKey) {
  const center = mapRuntime.stateCenters.get(stateKey);
  if (!center || !feature?.traits?.length) continue;
  for (const [index, trait] of feature.traits.entries()) {
    const image = mapRuntime.stateTraitIconImages.get(stateTraitIconFileName(trait));
    if (!image) continue;
    const offsetX = (index - (feature.traits.length - 1) / 2) * mapIconSize;
    const visible = mapRuntime.visibleStateKeys.has(stateKey);
    const matching = feature.matchingTraits?.includes(trait);
    context.globalAlpha = visible ? (specificFiltersActive && !matching ? 0.18 : 1) : 0.36;
    for (let copy = copyRange.start; copy <= copyRange.end; copy += 1) {
      context.drawImage(image, center.x + copy * mapRuntime.width + offsetX - mapIconSize / 2, center.y - mapIconSize / 2, mapIconSize, mapIconSize);
    }
  }
}
context.restore();
```

保留单行、固定屏幕尺寸和允许跨地域重叠的现有坐标机制。

- [ ] **Step 10: 把悬停提示图标改为 38×38 像素并更新样式导入缓存键。**

```css
.map-tooltip-trait-icon {
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  object-fit: contain;
}
```

在 `site/styles.css` 中把 `map.css` 的查询参数改为 `20260803-state-trait-filter1`。

同步把 `scripts/check_resource_map_colors.mjs` 中对 `site/styles.css` 内部 `map.css` 查询参数的预期改为 `20260803-state-trait-filter1`。

`site/app/presentation.js` 已在本任务修改，因此同时把 `site/index.html` 中该脚本的查询参数改为 `20260803-state-trait-filter1`。

- [ ] **Step 11: 运行静态测试和语法检查。**

Run:

```powershell
node scripts/check_state_trait_map.mjs
node --check site/app/runtime.js
node --check site/app/filters.js
node --check site/app/ui.js
node --check site/app/map.js
```

Expected: 所有命令退出码为 0；静态测试输出 `"state_trait_map": "ok"`。

- [ ] **Step 12: 提交地图显示和尺寸修改。**

```powershell
git add site/index.html site/app/map.js site/app/presentation.js site/styles/map.css site/styles.css scripts/check_state_trait_map.mjs scripts/check_state_trait_map_browser.mjs scripts/check_resource_map_colors.mjs
git commit -m "feat: highlight filtered state traits"
```

### Task 5: 完成真实浏览器交互回归

**Files:**
- Modify: `scripts/check_state_trait_map_browser.mjs`

- [ ] **Step 1: 增加“所有”与具体分类互斥测试。**

新建独立页面并先进入未筛选的地域板块，然后执行“所有 → 河流海港 → 所有”：

```js
const interaction = await context.newPage();
await interaction.goto(`${baseUrl}/main/index.html#/region`, { waitUntil: "networkidle", timeout: 45000 });
const interactionTraitSection = interaction.locator(".filter-section:has(#stateTraitFilters)");
await interactionTraitSection.locator("summary").click();
await interaction.locator("[data-state-trait-filter='all']").click();
assert.deepEqual(await selectedTraitFilters(interaction), ["all"]);
await interaction.locator("[data-state-trait-filter='waterways']").click();
assert.deepEqual(await selectedTraitFilters(interaction), ["waterways"]);
await interaction.locator("[data-state-trait-filter='all']").click();
assert.deepEqual(await selectedTraitFilters(interaction), ["all"]);
assert.equal(await interaction.evaluate(() => window.eval("state.mapMode")), "traitIcons");
```

保留 `interaction` 页面供 Step 2 和 Step 3 连续执行，完成 Step 3 后执行 `await interaction.close()`。

并在脚本末尾增加：

```js
function selectedTraitFilters(page) {
  return page.evaluate(() => [...window.eval("state.stateTraitFilters")].sort());
}
```

- [ ] **Step 2: 增加清空最后一个选项退出视图的测试。**

```js
await interaction.locator("[data-state-trait-filter='waterways']").click();
await interaction.locator("[data-state-trait-filter='waterways']").click();
const cleared = await interaction.evaluate(() => ({
  selected: [...window.eval("state.stateTraitFilters")],
  mode: window.eval("state.mapMode"),
}));
assert.deepEqual(cleared.selected, [], "clearing the last trait filter should empty the selection");
assert.equal(cleared.mode, "strategicRegion", "clearing the last trait filter should restore the normal region map");
```

- [ ] **Step 3: 增加地形互斥、全局重置和跨板块恢复测试。**

按以下顺序和状态断言执行：

```js
await interaction.locator("[data-state-trait-filter='mapi']").click();
await interaction.locator("#terrainMapViewButton").click();
assert.deepEqual(await selectedTraitFilters(interaction), []);
assert.equal(await interaction.evaluate(() => window.eval("state.mapMode")), "terrain");

await interaction.locator("[data-state-trait-filter='mapi']").click();
assert.equal(await interaction.locator("#terrainMapViewButton").getAttribute("aria-pressed"), "false");
assert.equal(await interaction.evaluate(() => window.eval("state.mapMode")), "traitIcons");

await interaction.locator("#countryViewButton").click();
assert.deepEqual(await selectedTraitFilters(interaction), ["mapi"]);
await interaction.locator("#regionViewButton").click();
assert.deepEqual(await selectedTraitFilters(interaction), ["mapi"]);
assert.equal(await interaction.evaluate(() => window.eval("state.mapMode")), "traitIcons");

await interaction.locator("#resetButton").click();
assert.deepEqual(await selectedTraitFilters(interaction), []);
assert.equal(await interaction.evaluate(() => window.eval("state.mapMode")), "strategicRegion");
await interaction.close();
```

- [ ] **Step 4: 确认悬停提示仍显示完整特质集合。**

增加以下精确采样函数，在具体分类激活时寻找同时含命中与未命中特质且位于当前画布内的地域：

```js
async function mixedTraitTarget(page) {
  return page.evaluate(() => {
    const runtime = window.eval("mapRuntime");
    const stateRegionFromPointerEvent = window.eval("stateRegionFromPointerEvent");
    const rect = document.querySelector("#mapCanvas").getBoundingClientRect();
    const eligible = new Map([...runtime.featureByStateKey].filter(([, feature]) => (
      feature.matchingTraits.length > 0 && feature.matchingTraits.length < feature.traits.length
    )));
    for (let y = 0; y < runtime.height; y += 8) {
      for (let x = 0; x < runtime.width; x += 8) {
        const stateKey = runtime.stateKeysByIndex[runtime.pixelStateIndexes[y * runtime.width + x] || 0];
        const feature = eligible.get(stateKey);
        if (!feature) continue;
        const clientX = rect.left + runtime.transform.x + (x + 0.5) * runtime.transform.scale;
        const clientY = rect.top + runtime.transform.y + (y + 0.5) * runtime.transform.scale;
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) continue;
        if (stateRegionFromPointerEvent({ clientX, clientY })?.key !== stateKey) continue;
        return {
          stateKey,
          traitCount: feature.traits.length,
          matchingTraitCount: feature.matchingTraits.length,
          pointer: { clientX, clientY, pointerId: 1, pointerType: "mouse" },
        };
      }
    }
    return null;
  });
}

const mixedTarget = await mixedTraitTarget(page);
assert(mixedTarget && mixedTarget.traitCount > mixedTarget.matchingTraitCount, "fixture should contain matching and nonmatching traits");
await page.locator("#mapCanvas").dispatchEvent("pointermove", mixedTarget.pointer);
await page.waitForFunction(() => document.querySelector("#mapTooltip")?.hidden === false, { timeout: 10000 });
assert.equal(await page.locator("#mapTooltip .map-tooltip-trait-icon").count(), mixedTarget.traitCount, "tooltip should retain the complete trait set");
```

- [ ] **Step 5: 在 Victorian Century 重复分类、尺寸和错误检查。**

至少验证“所有”、MAPI 与“土壤地貌＋自然资源”的“或”组合。具体断言为：

```js
await victorianCentury.locator("[data-state-trait-filter='mapi']").click();
assert.deepEqual(await selectedTraitFilters(victorianCentury), ["mapi"]);
await victorianCentury.locator("[data-state-trait-filter='land']").click();
await victorianCentury.locator("[data-state-trait-filter='mapi']").click();
await victorianCentury.locator("[data-state-trait-filter='resources']").click();
assert.deepEqual(await selectedTraitFilters(victorianCentury), ["land", "resources"]);
assert.equal(await victorianCentury.evaluate(() => window.eval("mapRuntime.featureByStateKey.size")), 781);
assert.equal(await victorianCentury.evaluate(() => window.eval("mapRuntime.stateTraitIconImages.size")), 23);
const vcMixedTarget = await mixedTraitTarget(victorianCentury);
assert(vcMixedTarget, "Victorian Century should expose an on-canvas mixed trait region");
await victorianCentury.locator("#mapCanvas").dispatchEvent("pointermove", vcMixedTarget.pointer);
await victorianCentury.waitForFunction(() => document.querySelector("#mapTooltip")?.hidden === false, { timeout: 10000 });
const vcTooltipIconBox = await victorianCentury.locator("#mapTooltip .map-tooltip-trait-icon").first().boundingBox();
assert.deepEqual({ width: vcTooltipIconBox?.width, height: vcTooltipIconBox?.height }, { width: 38, height: 38 });
assert.deepEqual(vcErrors, [], `Victorian Century page errors: ${vcErrors.join(" | ")}`);
```

- [ ] **Step 6: 验证与现有资源筛选共同生效及空结果状态。**

在主站的独立页面中选择“所有”和小麦农场资源，并比较列表及地图可见集合：

```js
const combined = await context.newPage();
await combined.goto(`${baseUrl}/main/index.html#/region`, { waitUntil: "networkidle", timeout: 45000 });
await combined.locator("[data-state-trait-filter='all']").click();
await combined.locator("[data-resource-filter='building_wheat_farm']").click();
const combinedState = await combined.evaluate(() => ({
  mode: window.eval("state.mapMode"),
  listed: document.querySelectorAll("[data-state-region]").length,
  expected: window.eval("landStateRegions").filter(window.eval("matchesStateRegionFilters")).length,
  visible: window.eval("mapRuntime.visibleStateKeys.size"),
}));
assert.equal(combinedState.mode, "traitIcons");
assert.equal(combinedState.listed, combinedState.expected);
assert(combinedState.visible > 0 && combinedState.visible < 781);

await combined.locator("#searchInput").fill("__no_state_trait_result__");
await combined.waitForFunction(() => document.querySelectorAll("[data-state-region]").length === 0);
assert.match(await combined.locator("#countryList").innerText(), /没有匹配结果/);
assert.equal(await combined.evaluate(() => window.eval("mapRuntime.visibleStateKeys.size")), 0, "empty results should mute every region");
await combined.close();
```

- [ ] **Step 7: 在 390×844 视口验证筛选和布局。**

检查以下指标：

```js
const narrowMetrics = await narrow.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  viewportWidth: window.innerWidth,
  mode: window.eval("state.mapMode"),
  selected: [...window.eval("state.stateTraitFilters")],
}));
assert.equal(narrowMetrics.scrollWidth, narrowMetrics.viewportWidth);
assert.equal(narrowMetrics.mode, "traitIcons");
assert.deepEqual(narrowMetrics.selected, ["all"]);
const narrowLayout = await traitIconLayout(narrow);
assert(narrowLayout.screenWidths.every((width) => Math.abs(width - 38) < 0.01));
```

- [ ] **Step 8: 重建本地 Victorian Century 前端副本。**

Run:

```powershell
node scripts/build_victorian_century_site.mjs --source site --target 'Victorian Century Database' --publish-target site/vc --skip-vc-assets
```

Expected: 输出 `"victorian_century_site_build": "ok"`。`Victorian Century Database/` 与 `site/vc/` 均为忽略目录，不加入提交。

- [ ] **Step 9: 创建只含两个目录联接的临时预览根并运行浏览器测试。**

Run:

```powershell
$previewRoot = Join-Path $env:TEMP ('vicdata-state-trait-filter-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $previewRoot | Out-Null
New-Item -ItemType Junction -Path (Join-Path $previewRoot 'main') -Target (Resolve-Path 'site') | Out-Null
New-Item -ItemType Junction -Path (Join-Path $previewRoot 'vc') -Target (Resolve-Path 'site/vc') | Out-Null
node scripts/check_state_trait_map_browser.mjs $previewRoot
```

Expected: 输出 `"state_trait_map_browser": "ok"`，主站、Victorian Century 和窄屏断言全部通过。

- [ ] **Step 10: 删除本次创建的临时目录联接。**

先确认 `$previewRoot` 位于 `$env:TEMP` 且名称以 `vicdata-state-trait-filter-` 开头，再显式删除两个目录联接，最后删除空的预览根：

```powershell
$resolvedPreview = [System.IO.Path]::GetFullPath($previewRoot)
$resolvedTemp = [System.IO.Path]::GetFullPath($env:TEMP)
if ($resolvedPreview.StartsWith($resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolvedPreview -Leaf).StartsWith('vicdata-state-trait-filter-')) {
  Remove-Item -LiteralPath (Join-Path $resolvedPreview 'main')
  Remove-Item -LiteralPath (Join-Path $resolvedPreview 'vc')
  Remove-Item -LiteralPath $resolvedPreview
} else {
  throw "Unexpected preview path: $resolvedPreview"
}
```

- [ ] **Step 11: 提交浏览器回归。**

```powershell
git add scripts/check_state_trait_map_browser.mjs
git commit -m "test: cover state trait filter interactions"
```

### Task 6: 全量验证和工作记录

**Files:**
- Modify: `docs/worklog/2026-08-03-state-trait-map.md`

- [ ] **Step 1: 运行地区地图相关静态回归。**

Run:

```powershell
$env:VICDATA_DATA_ROOT='D:\Bot\Vic3\Victoria3_DB'
$env:VICDATA_VC_DATA_ROOT='D:\Bot\Vic3\Victoria3_DB'
node scripts/check_state_trait_map.mjs
node scripts/check_province_terrain_map.mjs
node scripts/check_region_map_interaction.mjs
node scripts/check_map_state_centers.mjs
node scripts/check_resource_map_colors.mjs
```

Expected: 五项均输出各自的 `ok` JSON，退出码均为 0。

- [ ] **Step 2: 运行所有变更脚本的语法检查。**

Run:

```powershell
node --check site/app/runtime.js
node --check site/app/filters.js
node --check site/app/ui.js
node --check site/app/map.js
node --check scripts/check_state_trait_map.mjs
node --check scripts/check_state_trait_map_browser.mjs
```

Expected: 六项均无输出且退出码为 0。

- [ ] **Step 3: 再运行一次最终浏览器回归。**

Run:

```powershell
$finalPreviewRoot = Join-Path $env:TEMP ('vicdata-state-trait-filter-final-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $finalPreviewRoot | Out-Null
New-Item -ItemType Junction -Path (Join-Path $finalPreviewRoot 'main') -Target (Resolve-Path 'site') | Out-Null
New-Item -ItemType Junction -Path (Join-Path $finalPreviewRoot 'vc') -Target (Resolve-Path 'site/vc') | Out-Null
node scripts/check_state_trait_map_browser.mjs $finalPreviewRoot
$resolvedFinalPreview = [System.IO.Path]::GetFullPath($finalPreviewRoot)
$resolvedTemp = [System.IO.Path]::GetFullPath($env:TEMP)
if ($resolvedFinalPreview.StartsWith($resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolvedFinalPreview -Leaf).StartsWith('vicdata-state-trait-filter-final-')) {
  Remove-Item -LiteralPath (Join-Path $resolvedFinalPreview 'main')
  Remove-Item -LiteralPath (Join-Path $resolvedFinalPreview 'vc')
  Remove-Item -LiteralPath $resolvedFinalPreview
} else {
  throw "Unexpected preview path: $resolvedFinalPreview"
}
```

Expected: 主站、Victorian Century、390×844 视口、分类组合、互斥、恢复、列表、明暗和 38 像素断言全部通过，控制台及页面错误为空。

- [ ] **Step 4: 更新工作记录。**

在 `docs/worklog/2026-08-03-state-trait-map.md` 末尾增加“地区特质筛选”小节，记录六个选项、“所有”互斥、五个具体分类按“或”匹配、结构化分类、完整悬停提示、1/0.18/0.36 图标明暗、38 像素尺寸，以及原版和 Victorian Century 的浏览器验证结果。

- [ ] **Step 5: 检查提交范围和空白错误。**

Run:

```powershell
git diff --check
git status --short
git diff --stat HEAD~5
```

Expected: `git diff --check` 无输出；`.gitignore` 的既有修改仍未暂存；忽略目录不进入提交。

- [ ] **Step 6: 提交工作记录。**

```powershell
git add docs/worklog/2026-08-03-state-trait-map.md
git commit -m "docs: record state trait filter verification"
```

- [ ] **Step 7: 核对最终分支状态。**

Run:

```powershell
git log -6 --oneline
git status --short
```

Expected: 可见本计划对应的五个实施提交；工作树只保留用户既有的 `.gitignore` 修改，没有未提交的功能文件。
