# 地域地图焦点配色实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 地域板块选中陆地地域时，将该地域显示为拉普拉塔绿，并把其他陆地地域灰显。

**Architecture:** 继续使用 `state.selectedStateRegion` 作为地图和右侧卡片共用的焦点状态。`regionMapStateRegions` 将焦点地域作为唯一可见陆地地域，`mapFeatureColor` 依此灰显其他陆地；`buildStrategicRegionMapFeatures` 只覆盖焦点地域的填充色，保留未选中时的战略区域底图。

**Tech Stack:** 原生 JavaScript、Node.js 静态回归检查、浏览器画布地图。

---

### Task 1: 先写焦点配色的失败回归检查

**Files:**
- Modify: `scripts/check_region_map_interaction.mjs:9-24, 55-66`
- Test: `scripts/check_region_map_interaction.mjs`

- [ ] **Step 1: 在主检查序列加入焦点配色检查**

在现有三个 `check...` 调用之后加入：

```js
checkRegionMapClickContracts();
checkRegionRowDetailButtonContracts();
checkRegionMapListSyncContracts();
checkRegionMapFocusColorContracts();
```

- [ ] **Step 2: 写入失败断言**

在 `checkRegionMapListSyncContracts` 后加入以下函数：

```js
function checkRegionMapFocusColorContracts() {
  const regionMapStateRegions = functionSource("regionMapStateRegions");
  const buildStrategicRegionMapFeatures = functionSource("buildStrategicRegionMapFeatures");

  assert(/const selectedStateRegion = byStateRegion\.get\(state\.selectedStateRegion\);/.test(regionMapStateRegions), "region map should resolve the selected state region before choosing visible states");
  assert(/selectedStateRegion && !isSeaStateRegion\(selectedStateRegion\)[\s\S]*return \[selectedStateRegion\]/.test(regionMapStateRegions), "a selected land state region should be the only visible land focus");
  assert(/const REGION_MAP_FOCUS_COLOR = "#00cc66"/.test(appSource), "region map focus should use La Plata green");
  assert(/stateRegion\.key === state\.selectedStateRegion[\s\S]*REGION_MAP_FOCUS_COLOR/.test(buildStrategicRegionMapFeatures), "the selected state region should use the focus color");
}
```

- [ ] **Step 3: 运行检查并确认预期失败**

Run: `node scripts/check_region_map_interaction.mjs`

Expected: 以 `region map should resolve the selected state region before choosing visible states` 失败，因为生产代码尚未读取焦点地域。

- [ ] **Step 4: 提交失败测试**

不要在此步单独提交；失败测试与最小实现放入同一功能提交，避免主分支留下预期失败的提交。

### Task 2: 仅在地域焦点存在时重绘地域地图

**Files:**
- Modify: `site/app/map.js:295-296, 522-560`
- Test: `scripts/check_region_map_interaction.mjs`

- [ ] **Step 1: 定义焦点色**

紧接公司位置色常量前加入：

```js
const REGION_MAP_FOCUS_COLOR = "#00cc66";
const COMPANY_LOCATION_MAP_COLOR = "#00cc66";
const COMPANY_LOCATION_BORDER_COLOR = "#c8a45b";
```

- [ ] **Step 2: 让可见地域集合优先使用当前陆地焦点**

将 `regionMapStateRegions` 开头替换为：

```js
function regionMapStateRegions(filteredStateRegions, filteredSeaStateRegions, filteredGeographicRegions) {
  const selectedStateRegion = byStateRegion.get(state.selectedStateRegion);
  if (selectedStateRegion && !isSeaStateRegion(selectedStateRegion)) return [selectedStateRegion];
  if (state.selectedGeographicRegion) {
```

保留该函数其余分支不变。这样未选中地域时，地理区域、资源和战略区域筛选仍沿用当前可见集合；选中陆地地域时，`mapFeatureColor` 把其他陆地绘为 `MAP_MUTED_COLOR`，海域继续使用 `MAP_SEA_COLOR`。

- [ ] **Step 3: 覆盖焦点地域的战略区域填充色**

将 `buildStrategicRegionMapFeatures` 中 `color` 的陆地分支替换为：

```js
    const color = isSea
      ? MAP_SEA_COLOR
      : stateRegion.key === state.selectedStateRegion
        ? REGION_MAP_FOCUS_COLOR
        : inGeographicRegion
          ? "#4f8a61"
          : region?.map_color?.hex || "#d7d8cf";
```

保留 `color: mapFeatureColor(stateRegion, color)`。因此焦点地域获得 `#00cc66`，其余陆地由可见集合决定是否灰显，未选中时仍保留原有战略区域颜色。

- [ ] **Step 4: 运行回归检查并确认通过**

Run: `node scripts/check_region_map_interaction.mjs`

Expected: 输出 JSON，其中 `region_map_interaction` 为 `"ok"`。

- [ ] **Step 5: 运行语法和相关地图检查**

Run: `node --check site/app/map.js && node scripts/check_country_map_selection.mjs && git diff --check`

Expected: 三个命令均以退出码 `0` 结束；国家地图选择检查仍输出 `country_map_selection: "ok"`。

- [ ] **Step 6: 提交实现和回归检查**

```bash
git add site/app/map.js scripts/check_region_map_interaction.mjs
git commit -m "fix: highlight selected region on map"
```

### Task 3: 在浏览器验证双入口和原有双击行为

**Files:**
- Verify: `site/app/map.js`
- Verify: `site/app/boards.js`
- Verify: `scripts/check_region_map_interaction.mjs`

- [ ] **Step 1: 打开地域板块并等待地域卡片出现**

使用本地站点的 `#/region` 路由，等待至少一个 `[data-state-region]` 元素可见，再读取画布显示状态。避免在渲染前访问页面闭包变量。

- [ ] **Step 2: 验证地图单击入口**

单击一个陆地地域，确认地址仍为 `#/region`，对应地域卡片带有当前选中状态，目标地域居中。读取画布中目标像素的 RGB 值并确认是 `#00cc66`，再读取一个非目标陆地像素并确认是灰色；海域颜色不作为灰显断言。

- [ ] **Step 3: 验证右侧卡片入口**

单击另一张 `[data-state-region]` 卡片的主体，确认地址仍为 `#/region`，地图中心和绿色地域切换到该卡片对应地域，原先焦点地域变为灰色。

- [ ] **Step 4: 验证双击详情回归**

双击一个地域，确认地址变为 `#/state-region/<key>` 并显示对应详情标题。运行：`node scripts/check_region_map_interaction.mjs`。预期输出 `region_map_interaction: "ok"`。

- [ ] **Step 5: 记录验证结果**

在完成后把命令结果、浏览器中使用的地域键与两种单击入口的实际状态写入 `docs/worklog/2026-07-28.md`；如需更新根 `WORKLOG.md`，只更新当前状态和该详细记录的索引。
