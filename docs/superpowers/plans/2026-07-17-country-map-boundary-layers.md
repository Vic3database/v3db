# 国家地图边界层级实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在国家板块中将国界绘制在州地区界上方，同时维持其他资料板块原有的地图边界表现。

**Architecture:** 将单一边界函数拆成州地区界和国界两个函数。`drawMapLayer` 先画州地区界及海岸线；仅在 `state.mapMode === "country"` 且具备开局归属像素索引时，追加国界覆盖层。

**Tech Stack:** 原生 JavaScript、Canvas 2D、Node.js 静态契约检查。

---

### Task 1: 编写国家边界图层的失败检查

**Files:**

- Modify: `D:\Bot\Vic3\Victoria3_DB\scripts\check_country_map_selection.mjs`
- Test: `D:\Bot\Vic3\Victoria3_DB\scripts\check_country_map_selection.mjs`

- [x] **Step 1: 在 `checkMapSelectionContracts` 中声明函数源码。**

```js
const drawMapLayer = functionSource("drawMapLayer");
const addStateBorders = functionSource("addStateBorders");
const addCountryBorders = functionSource("addCountryBorders");
```

- [x] **Step 2: 写入失败断言。**

```js
assert(/addStateBorders\(data, stateIndexes, mapRuntime\.width, mapRuntime\.height\)/.test(drawMapLayer), "map layer should draw state borders before country borders");
assert(/state\.mapMode === "country"[\s\S]*addCountryBorders\(data, stateIndexes, mapRuntime\.pixelOwnerIndexes, mapRuntime\.width, mapRuntime\.height\)/.test(drawMapLayer), "country map should overlay country borders only in the country board");
assert(/const stateBorderColor = \[/.test(addStateBorders), "state-border renderer should own its subdued border color");
assert(/const countryBorderColor = \[/.test(addCountryBorders), "country-border renderer should own its stronger border color");
assert(/ownerIndexes\[pixel\][\s\S]*ownerIndexes\[rightPixel\]/.test(addCountryBorders), "country borders should compare adjacent owner indexes");
assert(/indexTouchesSea/.test(addCountryBorders), "country borders should exclude coastlines from the country-boundary overlay");
```

- [x] **Step 3: 运行 `node scripts/check_country_map_selection.mjs`。**

预期：退出码为 `1`，仅新增的图层相关断言失败。

- [x] **Step 4: 将失败检查与实现合并提交，避免留下仅失败的主分支提交。**

```powershell
git add scripts/check_country_map_selection.mjs
git commit -m "test: define country map boundary layers"
```

### Task 2: 拆分州地区界与国界绘制

**Files:**

- Modify: `D:\Bot\Vic3\Victoria3_DB\site\app.js:4679-4810`
- Test: `D:\Bot\Vic3\Victoria3_DB\scripts\check_country_map_selection.mjs`

- [x] **Step 1: 在 `drawMapLayer` 中以以下调用替换 `addMapBorders`。**

```js
addStateBorders(data, stateIndexes, mapRuntime.width, mapRuntime.height);
if (state.mapMode === "country" && mapRuntime.pixelOwnerIndexes) {
  addCountryBorders(data, stateIndexes, mapRuntime.pixelOwnerIndexes, mapRuntime.width, mapRuntime.height);
}
```

- [x] **Step 2: 以 `addStateBorders` 替换 `addMapBorders`。**

```js
function addStateBorders(data, stateIndexes, width, height) {
  const stateBorderColor = [82, 93, 87];
  const seaBorder = hexToRgb(MAP_SEA_BORDER_COLOR);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width;
    const hasDown = y < height - 1;
    for (let x = 0; x < width; x += 1) {
      const pixel = rowStart + x;
      const index = stateIndexes[pixel];
      if (!index) continue;
      const rightPixel = x === width - 1 ? rowStart : pixel + 1;
      const downPixel = hasDown ? pixel + width : -1;
      const rightIndex = stateIndexes[rightPixel];
      const downIndex = hasDown ? stateIndexes[downPixel] : index;
      if (index === rightIndex && index === downIndex) continue;
      const color = indexTouchesSea(index, rightIndex) || indexTouchesSea(index, downIndex)
        ? seaBorder
        : stateBorderColor;
      paintBorderPixel(data, pixel, color);
      if (index !== rightIndex && rightIndex) paintBorderPixel(data, rightPixel, color);
      if (hasDown && index !== downIndex && downIndex) paintBorderPixel(data, downPixel, color);
    }
  }
}
```

- [x] **Step 3: 紧接 `addStateBorders` 新增国界覆盖函数。**

```js
function addCountryBorders(data, stateIndexes, ownerIndexes, width, height) {
  const countryBorderColor = [33, 43, 39];
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width;
    const hasDown = y < height - 1;
    for (let x = 0; x < width; x += 1) {
      const pixel = rowStart + x;
      const index = stateIndexes[pixel];
      if (!index) continue;
      const rightPixel = x === width - 1 ? rowStart : pixel + 1;
      const downPixel = hasDown ? pixel + width : -1;
      const rightIndex = stateIndexes[rightPixel];
      const downIndex = hasDown ? stateIndexes[downPixel] : index;
      const crossesRight = (ownerIndexes[pixel] || 0) !== (ownerIndexes[rightPixel] || 0);
      const crossesDown = hasDown && (ownerIndexes[pixel] || 0) !== (ownerIndexes[downPixel] || 0);
      if ((!crossesRight && !crossesDown) || indexTouchesSea(index, rightIndex) || indexTouchesSea(index, downIndex)) continue;
      paintBorderPixel(data, pixel, countryBorderColor);
      if (crossesRight && rightIndex) paintBorderPixel(data, rightPixel, countryBorderColor);
      if (crossesDown && downIndex) paintBorderPixel(data, downPixel, countryBorderColor);
    }
  }
}
```

- [x] **Step 4: 执行 `node scripts/check_country_map_selection.mjs`、`node --check site/app.js` 和 `git diff --check`。**

预期：三条命令均以退出码 `0` 结束，国家地图检查输出 `country_map_selection: "ok"`。

- [ ] **Step 5: 提交实现、检查与本计划。**

```powershell
git add site/app.js scripts/check_country_map_selection.mjs
git commit -m "feat: layer country borders on country maps"
```

### Task 3: 浏览器核验国家与地区板块

**Files:**

- Modify: 无
- Test: `D:\Bot\Vic3\Victoria3_DB\site\index.html`

- [x] **Step 1: 使用本地静态服务打开 `http://127.0.0.1:8876/index.html#/country`。**

确认国境内部州地区界为较淡细线，跨国边界以深色国界覆盖，海岸线保持海域边界色；读取控制台，确认没有错误。

- [x] **Step 2: 打开 `http://127.0.0.1:8876/index.html#/region`。**

确认地区板块仍是原有单层州地区边界，没有国界叠加；读取控制台，确认没有错误。

- [ ] **Step 3: 运行 `git status --short` 与 `git log -2 --oneline`。**

预期：可见前两项任务的提交，工作区只保留本任务范围外的既有未提交文件。
