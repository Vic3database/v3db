# 省份地形图实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在地域板块中提供受现有地域筛选约束的省份地形视图。

**Architecture:** 构建脚本从游戏的 `province_terrains.txt` 和 `provinces.png` 生成地形、原始省份颜色和地域三组像素游程索引。地图运行时一次解码索引，地形模式以省份层级绘制颜色并保留地域交互。筛选栏入口只切换地域地图模式，右侧地域列表沿用原有渲染。

**Tech Stack:** PowerShell、Node.js 静态断言、原生 JavaScript、Canvas、CSS。

---

### Task 1: 生成省份地形和颜色索引

**Files:**
- Modify: `scripts/build_map_data.ps1`
- Create: `scripts/check_province_terrain_map.mjs`
- Modify: `site/map-data.js`
- Modify: `site/versions/1.13.9/map-data.js`
- Modify: `Victorian Century Database/map-data.js`

- [ ] **Step 1: 写入地形构建断言**

在 `scripts/check_province_terrain_map.mjs` 中执行每份 `map-data.js`，并要求包含 `terrainKeys`、`provinceColorKeys`、`terrainRuns` 与 `provinceRuns`。断言十种陆地键和 `ocean`、`lakes` 都存在，三组游程的长度均为偶数，分别解码为 `width * height` 个像素。用 `x48E2A5` 断言代码表保留游戏原始前缀，并验证该代码在地形表中对应 `desert`。

```js
assert.deepEqual(new Set(map.terrainKeys.slice(1)), new Set([
  "desert", "forest", "hills", "jungle", "lakes", "mountain",
  "ocean", "plains", "savanna", "snow", "tundra", "wetland",
]));
assert.equal(decodeRuns(map.terrainRuns, pixels).length, pixels);
assert.equal(map.provinceColorKeys.includes("x48E2A5"), true);
```

- [ ] **Step 2: 运行断言并确认失败原因是索引尚未生成**

运行：`node scripts/check_province_terrain_map.mjs`

预期：失败信息指出 `terrainKeys`、`terrainRuns`、`provinceColorKeys` 或 `provinceRuns` 缺失。

- [ ] **Step 3: 扩展地图构建脚本**

在 `scripts/build_map_data.ps1` 加入参数：

```powershell
[string]$TerrainFile = "D:\SteamLibrary\steamapps\common\Victoria 3\game\map_data\province_terrains.txt"
```

读取每个符合 `^x([0-9A-Fa-f]{6})\s*=\s*"([^"]+)"` 的行，规范化为 `x` 加大写六位色码。按地形键建立 `terrainKeys` 与 `$colorToTerrainIndex`，按省份色码建立 `provinceColorKeys` 与 `$colorToProvinceIndex`。在现有像素循环中同时写入 `terrainRuns` 和 `provinceRuns`；输出对象新增四个字段。保留当前地区和开局所有权索引的字段名及行为。

```powershell
$terrainMatch = [regex]::Match($line, '^x([0-9A-Fa-f]{6})\s*=\s*"([^"]+)"')
$provinceColor = "x$($terrainMatch.Groups[1].Value.ToUpperInvariant())"
$terrainKey = $terrainMatch.Groups[2].Value
$terrainIndex = [int]$colorToTerrainIndex[$provinceColor]
```

- [ ] **Step 4: 重建三份地图数据**

运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build_map_data.ps1 -Database database/vic3_1.13.9 -OutFile site/map-data.js
Copy-Item site/map-data.js site/versions/1.13.9/map-data.js
powershell -ExecutionPolicy Bypass -File scripts/build_map_data.ps1 -Database database/victorian_century -OutFile 'Victorian Century Database/map-data.js'
```

预期：三次输出都包含非零 `terrainRunPairs` 和 `provinceRunPairs`；主站两份内容完全一致。

- [ ] **Step 5: 运行构建断言并确认通过**

运行：`node scripts/check_province_terrain_map.mjs`

预期：输出包含三份地图数据的尺寸、12 种地形和完整像素长度。

- [ ] **Step 6: 提交构建数据阶段**

```powershell
git add scripts/build_map_data.ps1 scripts/check_province_terrain_map.mjs site/map-data.js site/versions/1.13.9/map-data.js 'Victorian Century Database/map-data.js'
git commit -m "feat: add province terrain map data"
```

### Task 2: 省份级地图绘制与提示内容

**Files:**
- Modify: `site/app/runtime.js`
- Modify: `site/app/data.js`
- Modify: `site/app/map.js`
- Modify: `scripts/check_province_terrain_map.mjs`

- [ ] **Step 1: 写入地图模式静态断言**

把断言扩展为要求 `mapRuntime` 包含 `terrainKeysByIndex`、`provinceColorKeysByIndex`、`pixelTerrainIndexes` 与 `pixelProvinceIndexes`；`ensureMapLoaded()` 解码两组游程；`drawMapLayer()` 在 `terrain` 模式按省份像素赋色；水体索引保持透明；`mapTooltipHtml()` 在地形模式输出省份代码和地形。

```js
assert.match(mapSource, /mapRuntime\.pixelTerrainIndexes = decodeMapRuns\(mapData\.terrainRuns/);
assert.match(mapSource, /state\.mapMode === "terrain"/);
assert.match(mapSource, /terrainProvinceCodeFromPointerEvent/);
assert.match(mapSource, /\["省份代码", terrainProvinceCodeFromPointerEvent/);
```

- [ ] **Step 2: 运行断言并确认失败原因是运行时尚未读取地形索引**

运行：`node scripts/check_province_terrain_map.mjs`

预期：失败信息指出地形运行时字段、绘制分支或提示字段缺失。

- [ ] **Step 3: 实现一次性索引解码与清理**

在 `site/app/runtime.js` 的 `mapRuntime` 增加四项索引字段，均使用空数组或 `null` 初始化。在 `site/app/data.js` 的 `resetMapRuntime()` 中一并复位。在 `ensureMapLoaded()` 中读取：

```js
mapRuntime.terrainKeysByIndex = mapData.terrainKeys || [""];
mapRuntime.provinceColorKeysByIndex = mapData.provinceColorKeys || [""];
mapRuntime.pixelTerrainIndexes = mapData.terrainRuns
  ? decodeMapRuns(mapData.terrainRuns, mapRuntime.width * mapRuntime.height)
  : null;
mapRuntime.pixelProvinceIndexes = mapData.provinceRuns
  ? decodeMapRuns(mapData.provinceRuns, mapRuntime.width * mapRuntime.height)
  : null;
```

- [ ] **Step 4: 实现地形颜色、按像素渲染和提示字段**

在 `site/app/map.js` 定义十种陆地地形的稳定颜色表和本地化名称表；使用 `terrain` 模式下的像素索引取色。只有当前 `visibleStateKeys` 内的陆地省份按地形色绘制，已筛掉的陆地继续使用 `MAP_MUTED_COLOR`，`ocean` 与 `lakes` 返回透明度 `MAP_SEA_ALPHA`。保留地区边界，且点击与双击仍通过 `stateRegionFromPointerEvent()` 执行。

新增 `terrainProvinceCodeFromPointerEvent(event)` 与 `terrainKeyFromPointerEvent(event)`。在地形模式的提示中显示：省份代码、地形、所属地域、战略区域；水体指针直接隐藏提示。

```js
if (state.mapMode === "terrain") {
  const terrainKey = terrainKeyFromPointerEvent(event);
  if (!terrainLandKeys.has(terrainKey)) return null;
  return compactTooltipRows([
    ["省份代码", terrainProvinceCodeFromPointerEvent(event)],
    ["地形", terrainLabel(terrainKey)],
    ["所属地域", stateRegion.name_zh || stateRegion.key],
    ["战略区域", refNames(stateRegion.strategic_regions)],
  ]);
}
```

- [ ] **Step 5: 运行断言并确认通过**

运行：`node scripts/check_province_terrain_map.mjs`

预期：输出表示构建数据、运行时索引、地形绘制和提示合同均通过。

- [ ] **Step 6: 提交地图运行时阶段**

```powershell
git add site/app/runtime.js site/app/data.js site/app/map.js scripts/check_province_terrain_map.mjs
git commit -m "feat: render province terrain map"
```

### Task 3: 地域筛选栏入口与地图图例

**Files:**
- Modify: `site/index.html`
- Modify: `site/app/runtime.js`
- Modify: `site/app/ui.js`
- Modify: `site/app/map.js`
- Modify: `site/styles/map.css`
- Modify: `site/styles/shell.css`
- Modify: `scripts/check_province_terrain_map.mjs`
- Modify: `scripts/check_region_map_interaction.mjs`

- [ ] **Step 1: 写入入口、筛选保持和图例的静态断言**

断言页面包含仅地域板块显示的 `#terrainMapViewButton` 与 `#terrainMapLegend`；按钮事件将 `state.regionMapView` 设置为 `terrain` 并渲染；`syncMapModeForView()` 在地域视图且该状态为 `terrain` 时优先选择 `terrain`；图例仅在地形模式可见，包含十种陆地键；现有地域地图的单击、双击合同仍成立。

```js
assert.match(indexSource, /id="terrainMapViewButton"/);
assert.match(functionSource(mapSource, "syncMapModeForView"), /state\.regionMapView === "terrain"/);
assert.match(functionSource(mapSource, "renderTerrainMapLegend"), /terrainLegendEntries/);
assert.match(regionInteractionSource, /openStateRegionDetail\(stateRegion\.key\)/);
```

- [ ] **Step 2: 运行断言并确认失败原因是入口和图例尚未存在**

运行：`node scripts/check_province_terrain_map.mjs; node scripts/check_region_map_interaction.mjs`

预期：地形断言失败，现有地域交互检查通过。

- [ ] **Step 3: 添加地域专属视图状态和筛选入口**

在 `state` 中新增 `regionMapView: "default"`，并在数据集重置、地域以外板块切换和清除筛选时恢复为默认值。筛选栏的地域筛选区新增按钮：

```html
<section class="filter-section region-only">
  <summary>地图</summary>
  <div class="option-list">
    <button id="terrainMapViewButton" class="filter-token" type="button" aria-pressed="false">地形视图</button>
  </div>
</section>
```

在 `bindEvents()` 绑定按钮，点击后在 `"default"` 与 `"terrain"` 间切换，更新 `aria-pressed` 并调用 `render()`。现有资源、战略区域和地理区域集合不被清空。

- [ ] **Step 4: 将地形模式接入地图控件和下方图例**

修改 `syncMapModeForView()`，在地域板块且 `state.regionMapView === "terrain"` 时设置 `state.mapMode = "terrain"`，优先于资源选择。`renderMapControls()` 更新按钮的按下状态，并调用 `renderTerrainMapLegend()`。

在地图面板的视口之后放置图例容器。`renderTerrainMapLegend()` 使用十条固定顺序的 `terrainLegendEntries` 渲染色块和名称，并在非地形模式时隐藏容器。样式使用可换行的弹性布局，确保 390 像素宽度下不产生横向滚动。

```html
<div id="terrainMapLegend" class="terrain-map-legend" aria-label="陆地地形图例" hidden></div>
```

```css
.terrain-map-legend { display: flex; flex-wrap: wrap; gap: 6px 10px; }
.terrain-map-legend[hidden] { display: none; }
```

- [ ] **Step 5: 更新缓存版本并运行静态检查**

更新 `site/index.html` 和 `site/styles.css` 中受修改脚本与样式的查询版本，避免主站和 Victorian Century 页面继续使用旧缓存。

运行：

```powershell
node scripts/check_province_terrain_map.mjs
node scripts/check_region_map_interaction.mjs
node scripts/check_map_state_centers.mjs
node --check site/app/runtime.js
node --check site/app/data.js
node --check site/app/ui.js
node --check site/app/map.js
git diff --check
```

预期：所有命令退出码为 `0`。

- [ ] **Step 6: 提交界面与交互阶段**

```powershell
git add site/index.html site/styles.css site/styles/map.css site/styles/shell.css site/app/runtime.js site/app/ui.js site/app/map.js scripts/check_province_terrain_map.mjs scripts/check_region_map_interaction.mjs
git commit -m "feat: add terrain view to region board"
```

### Task 4: 浏览器回归与发布包验证

**Files:**
- Modify: `docs/worklog/2026-08-02.md`

- [ ] **Step 1: 运行主站和 Victorian Century 的本地服务**

运行：`python -m http.server 8000 --directory site`

运行：`python -m http.server 8001 --directory 'Victorian Century Database'`

预期：两个本地静态服务均可访问。

- [ ] **Step 2: 验证桌面地形视图**

在 `http://127.0.0.1:8000/#/region` 打开地域板块，点击地形视图。确认十项图例可见，水体显示纸质底图；悬停已知沙漠省份显示 `x` 前缀代码和“沙漠”；点击该省份选中所属地域，双击进入地域详情。选择资源、战略区域和地理区域筛选后，确认未命中的陆地转为淡灰，右侧地域列表仍显示筛选结果。

- [ ] **Step 3: 验证窄屏和 Victorian Century**

在 390×844 视口重复打开地形视图，确认十项图例换行且页面无横向溢出。访问 `http://127.0.0.1:8001/#/region`，确认图例、地形颜色、水体、提示和地域筛选行为等同于主站。

- [ ] **Step 4: 运行全量静态与发布包检查**

运行：

```powershell
node scripts/check_province_terrain_map.mjs
node scripts/check_region_map_interaction.mjs
node scripts/check_map_state_centers.mjs
node scripts/check_resource_map_colors.mjs
node scripts/check_publish_bundle.mjs
git diff --check
```

预期：所有检查退出码为 `0`。

- [ ] **Step 5: 写入工作记录并提交验证记录**

在 `docs/worklog/2026-08-02.md` 增加地形图的数据来源、12 类源数据与 10 类陆地图例、构建输出、地图筛选规则、浏览器验证尺寸和通过的检查命令。

```powershell
git add docs/worklog/2026-08-02.md
git commit -m "docs: record province terrain map verification"
```
