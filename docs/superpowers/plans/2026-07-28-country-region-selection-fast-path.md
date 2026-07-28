# 国家与地域局部选中更新 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 国家与地域板块的左键单击只更新选中卡片和地图颜色，保留地图位置，避免重建全部卡片。

**Architecture:** 完整渲染继续负责筛选、排序、路由和板块切换。presentation.js 新增局部选择提交与卡片状态同步，boards.js 抽取地域地图筛选输入，ui.js 仅注册一次国家与地域列表的委托事件。局部选择仍调用现有 renderMap() 重绘颜色图层，但跳过列表重建、自动地图聚焦和列表平滑滚动。

**Tech Stack:** 原生 JavaScript、Canvas 2D、Node.js 静态检查、浏览器开发者工具。

---

### Task 1: 为局部选择行为建立失败的静态契约

**Files:**
- Modify: scripts/check_region_map_interaction.mjs:51-86
- Modify: scripts/check_country_map_selection.mjs:34-93

- [ ] **Step 1: 为地域选择写入失败断言**

在 checkRegionMapListSyncContracts() 中删除要求 scrollIntoView() 的断言，加入：

~~~
assert(!/scrollIntoView\(/.test(selectStateRegionFromMap), "region map selection should not scroll the list");
assert(!/\brender\(\)/.test(selectStateRegionFromMap), "region map selection should not rebuild the board");
assert(!/\brender\(\)/.test(functionSource("selectStateRegionCard")), "region card selection should not rebuild the board");
assert(!/focusStateRegionOnMap\(/.test(selectStateRegionFromMap), "region map selection should preserve the map transform");
assert(/commitStateRegionSelection\(/.test(selectStateRegionFromMap), "region map selection should use the shared fast commit path");
assert(/syncMapSelectedStateRegionCard\(/.test(appSource), "region fast selection should retain the temporary-card updater");
~~~

在 checkRegionMapFocusResetContracts() 后加入 checkPrimaryListEventContracts()。它取得 bindEvents 和 bindPrimaryListEvents 的源码，断言前者调用后者，后者识别 data-country-detail、data-state-region-detail、data-country 与 data-state-region。

- [ ] **Step 2: 为国家选择写入失败断言**

在 checkMapSelectionContracts() 中保留 renderCountryBoard() 自动聚焦的断言，因为完整渲染的行为不变。删除地图单击滚动断言，加入：

~~~
const selectCountryCard = functionSource("selectCountryCard");
assert(!/scrollIntoView\(/.test(selectCountryFromMap), "country map selection should not scroll the list");
assert(!/\brender\(\)/.test(selectCountryFromMap), "country map selection should not rebuild the board");
assert(!/\brender\(\)/.test(selectCountryCard), "country card selection should not rebuild the board");
assert(!/focusCountryOnMap\(/.test(selectCountryFromMap), "country map selection should preserve the map transform");
assert(/commitCountrySelection\(/.test(selectCountryFromMap), "country map selection should use the shared fast commit path");
assert(/mapRuntime\.filteredCountryTags\.has\(countryTag\)/.test(selectCountryFromMap), "country map selection should preserve filtered-out country clearing");
~~~

- [ ] **Step 3: 运行检查并确认失败**

Run: node scripts/check_region_map_interaction.mjs; node scripts/check_country_map_selection.mjs

Expected: 两个检查因尚不存在的局部提交函数、委托事件和“禁止完整渲染”契约失败。

- [ ] **Step 4: 提交失败检查**

~~~powershell
git add scripts/check_region_map_interaction.mjs scripts/check_country_map_selection.mjs
git commit -m "test: cover fast country and region selection"
~~~

### Task 2: 将国家与地域卡片事件改为一次性委托

**Files:**
- Modify: site/app/ui.js:1-160
- Modify: site/app/presentation.js:30-145
- Test: scripts/check_region_map_interaction.mjs:80-94

- [ ] **Step 1: 实现一次性列表事件注册**

在 bindEvents() 中调用 bindPrimaryListEvents()，并在 ui.js 中加入：

~~~js
function bindPrimaryListEvents() {
  const selectRow = (row) => {
    if (row.dataset.country) selectCountryCard(row.dataset.country);
    else if (row.dataset.stateRegion) selectStateRegionCard(row.dataset.stateRegion);
  };
  els.countryList?.addEventListener("click", (event) => {
    const detailButton = event.target.closest("[data-country-detail], [data-state-region-detail]");
    if (detailButton && els.countryList.contains(detailButton)) {
      event.preventDefault();
      if (detailButton.dataset.countryDetail) openCountryDetail(detailButton.dataset.countryDetail);
      else openStateRegionDetail(detailButton.dataset.stateRegionDetail);
      return;
    }
    if (event.target.closest("a, button, [data-concept-key]")) return;
    const row = event.target.closest("[data-country], [data-state-region]");
    if (row && els.countryList.contains(row)) selectRow(row);
  });
  els.countryList?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target.closest("a, button, [data-concept-key]")) return;
    const row = event.target.closest("[data-country], [data-state-region]");
    if (!row || !els.countryList.contains(row)) return;
    event.preventDefault();
    selectRow(row);
  });
}
~~~

- [ ] **Step 2: 删除逐卡片监听器**

从 renderCountryList() 和 renderRegionList() 删除紧随 innerHTML 赋值后的全部 els.countryList.querySelectorAll(...).forEach(...) 监听器代码块。两段既有 HTML 生成表达式保持原样，必须继续输出 data-country、data-state-region、data-country-detail、data-state-region-detail 与 tabindex，供 Task 2 的委托事件使用；不新增 countryRowHtml 或 regionListHtml 等函数。

- [ ] **Step 3: 运行地域检查**

Run: node scripts/check_region_map_interaction.mjs

Expected: 委托事件断言通过；局部选择提交函数的断言仍失败。

- [ ] **Step 4: 提交事件委托改动**

~~~powershell
git add site/app/ui.js site/app/presentation.js scripts/check_region_map_interaction.mjs
git commit -m "refactor: delegate country and region list events"
~~~

### Task 3: 实现局部选择与地图更新

**Files:**
- Modify: site/app/presentation.js:30-180
- Modify: site/app/boards.js:526-579
- Test: scripts/check_region_map_interaction.mjs:51-94
- Test: scripts/check_country_map_selection.mjs:34-93

- [ ] **Step 1: 抽取地域地图筛选输入**

在 boards.js 中将 renderRegionBoard() 开头的四组筛选结果和海域州计算移入 regionBoardMapInputs()。完整渲染继续用返回值生成列表并调用 focusStateRegionOnMap()。函数体和只更新地图的函数如下：

~~~js
function regionBoardMapInputs() {
  const filteredStrategicRegions = landStrategicRegions.filter(matchesStrategicRegionFilters).sort(sortStrategicRegionRef);
  const filteredSeaRegions = seaStrategicRegions.filter(matchesStrategicRegionFilters).sort(sortStrategicRegionRef);
  const filteredStateRegions = landStateRegions.filter(matchesStateRegionFilters).sort(sortStateRegions);
  const filteredGeographicRegions = geographicRegions.filter(matchesGeographicRegionFilters).sort(sortGeographicRegions);
  const filteredSeaStateRegions = uniqueByKey(filteredSeaRegions
    .flatMap((region) => region.states || [])
    .map((stateRef) => byStateRegion.get(stateRef.key))
    .filter(Boolean));
  return { filteredStrategicRegions, filteredSeaRegions, filteredStateRegions, filteredGeographicRegions, filteredSeaStateRegions };
}

function renderRegionMapForCurrentFilters() {
  const inputs = regionBoardMapInputs();
  renderMap(regionMapStateRegions(
    inputs.filteredStateRegions,
    inputs.filteredSeaStateRegions,
    inputs.filteredGeographicRegions,
  ));
}
~~~

此函数不生成卡片，保证选中海域时仍遵循现有地图规则。

- [ ] **Step 2: 复用地域卡片模板并同步选中态**

将地域 article 模板抽成 stateRegionRowHtml(stateRegion, options)，完整列表和临时卡片共同使用。函数和局部同步工具如下：

~~~js
function stateRegionRowHtml(stateRegion, { mapSelected = false } = {}) {
  const selected = mapSelected || (stateRegion.key === state.selectedStateRegion && state.detailKind === "stateRegion");
  const classes = "country-row region-row selectable-row" + (mapSelected ? " region-map-selected" : "");
  return [
    '<article class="' + classes + '" data-state-region="' + escapeHtml(stateRegion.key) + '" style="' + stateRegionBorderStyle(stateRegion) + '" aria-current="' + selected + '" tabindex="0">',
    '<span class="country-heading">',
    conceptTag(stateRegion.key, "stateRegion", stateRegion.key, stateRegion.name_zh),
    '<span class="name">' + stateRegionNameText(stateRegion) + '</span>',
    rowDetailButton("data-state-region-detail", stateRegion.key),
    '</span>',
    '<span class="minor country-meta">' + escapeHtml(stateRegionSummaryText(stateRegion)) + '</span>',
    '<span class="minor country-meta">本土文化：' + escapeHtml(refNames(stateRegion.homeland_cultures)) + '</span>',
    '<span class="pill-line country-tags">' + stateRegionTagPills(stateRegion) + '</span>',
    '<span class="region-building-strip">' + stateRegionBuildingStrip(stateRegion) + '</span>',
    '</article>',
  ].join("");
}

function rowsForSelection(attribute, key) {
  if (!key) return [];
  return [...els.countryList.querySelectorAll("[" + attribute + "]")]
    .filter((row) => row.getAttribute(attribute) === key);
}

function syncListSelection(attribute, previousKey, nextKey) {
  for (const row of rowsForSelection(attribute, previousKey)) row.setAttribute("aria-current", "false");
  for (const row of rowsForSelection(attribute, nextKey)) row.setAttribute("aria-current", "true");
}

function syncMapSelectedStateRegionCard() {
  els.countryList.querySelector(".region-map-selected")?.remove();
  const selected = byStateRegion.get(state.mapSelectedStateRegion);
  const visible = rowsForSelection("data-state-region", state.mapSelectedStateRegion).length > 0;
  if (!selected || visible) return;
  els.countryList.insertAdjacentHTML("afterbegin", stateRegionRowHtml(selected, { mapSelected: true }));
}
~~~

stateRegionRowHtml() 在 mapSelected 为真时输出 region-map-selected 类和 aria-current="true"，否则保留当前地域卡片的类、内容与选中表达式。

- [ ] **Step 3: 用共享提交函数替换四个左键入口**

在 presentation.js 中实现：

~~~js
function commitCountrySelection(countryTag) {
  const previousTag = state.selectedTag;
  state.globalSearchColorRestoreTag = "";
  state.selectedTag = countryTag;
  state.detailKind = "country";
  replaceHash(selectionHashForCard("/country", "/country/" + encodeURIComponent(countryTag)));
  syncListSelection("data-country", previousTag, state.selectedTag);
  renderMap(countryMapStateRegions(byTag.get(state.selectedTag)));
}

function commitStateRegionSelection(stateRegionKey, { fromMap }) {
  const previousKey = state.selectedStateRegion;
  state.selectedStateRegion = stateRegionKey;
  state.mapSelectedStateRegion = fromMap ? stateRegionKey : "";
  state.detailKind = "stateRegion";
  state.regionListMode = "state";
  replaceHash(fromMap ? "/region" : selectionHashForCard("/region", "/state-region/" + encodeURIComponent(stateRegionKey)));
  syncMapSelectedStateRegionCard();
  syncListSelection("data-state-region", previousKey, state.selectedStateRegion);
  renderRegionMapForCurrentFilters();
}
~~~

为国家地图筛选排除分支加入：

~~~js
function clearFilteredOutCountryMapSelection() {
  const previousTag = state.selectedTag;
  state.globalSearchColorRestoreTag = "";
  state.selectedTag = "";
  state.detailKind = "country";
  replaceHash("/country");
  syncListSelection("data-country", previousTag, "");
  renderMap(countryMapStateRegions(null));
}
~~~

selectCountryCard() 与 selectStateRegionCard() 只验证键后调用相应提交函数。selectCountryFromMap() 在 mapRuntime.filteredCountryTags 不含目标国家时调用 clearFilteredOutCountryMapSelection()，筛选包含目标国家时调用 commitCountrySelection()。selectStateRegionFromMap() 调用 commitStateRegionSelection(stateRegionKey, { fromMap: true })。四个入口均不得调用 render()、地图聚焦函数或 scrollIntoView()。

- [ ] **Step 4: 运行静态检查**

Run: node scripts/check_region_map_interaction.mjs; node scripts/check_country_map_selection.mjs; node --check site/app/presentation.js; node --check site/app/boards.js; node --check site/app/ui.js

Expected: 所有命令退出码为 0，两个选择检查分别输出 region_map_interaction: "ok" 与 country_map_selection: "ok"。

- [ ] **Step 5: 提交局部选择实现**

~~~powershell
git add site/app/presentation.js site/app/boards.js scripts/check_region_map_interaction.mjs scripts/check_country_map_selection.mjs
git commit -m "perf: update country and region selections locally"
~~~

### Task 4: 更新不可变脚本缓存并进行浏览器回归

**Files:**
- Modify: site/index.html:278-280
- Modify: scripts/check_region_map_interaction.mjs:83-94
- Modify: scripts/check_country_map_selection.mjs:34-93

- [ ] **Step 1: 更新缓存版本和断言**

将引用更新为：

~~~html
<script src="app/boards.js?v=20260728-selection-fast1"></script>
<script src="app/presentation.js?v=20260728-selection-fast1"></script>
~~~

在地域检查的 checkRegionMapCacheVersionContracts() 中加入：

~~~js
assert(/app\/presentation\.js\?v=20260728-selection-fast1/.test(indexSource), "fast region selection should use the current presentation cache version");
~~~

在国家检查顶部加入 const indexSource = readText("site/index.html");，并在 checkMapSelectionContracts() 中加入：

~~~js
assert(/app\/boards\.js\?v=20260728-selection-fast1/.test(indexSource), "fast country selection should use the current boards cache version");
~~~

- [ ] **Step 2: 进行浏览器回归**

Run: python -m http.server 8892 --directory site

在浏览器打开 http://127.0.0.1:8892/#/region 与 http://127.0.0.1:8892/#/country。每个板块先拖动地图到非初始位置，记录一张未选中卡片节点和 mapRuntime.transform，再连续单击两张右侧卡片和两处地图。确认地图位置未变、未选中卡片仍为同一节点、旧新卡片的 aria-current 正确、地图颜色切换正确，且地图单击未滚动右侧列表。

在地域筛选中从地图选择被筛掉的地域，确认顶部只有一张临时卡片；再选择正常地域或临时卡片，确认临时卡片按既有状态规则移除。国家筛选中从地图点选被筛掉的国家，确认没有残留选中卡片，地图恢复筛选颜色。最后确认国家与地域详情箭头、地域地图双击仍进入各自详情页。

- [ ] **Step 3: 运行完整回归并提交**

Run: node scripts/check_region_map_interaction.mjs; node scripts/check_country_map_selection.mjs; node scripts/check_deploy_vicdata_script.mjs; node --check site/app/presentation.js; node --check site/app/boards.js; node --check site/app/ui.js; git diff --check

Expected: 所有检查退出码为 0，浏览器控制台没有页面错误。

~~~powershell
git add site/index.html scripts/check_region_map_interaction.mjs scripts/check_country_map_selection.mjs
git commit -m "fix: version fast selection script assets"
~~~
