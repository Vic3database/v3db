# 资源地图颜色与农业文字水印 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为资源地图提供稳定的资源颜色，并在农业资源地图中按战略区域绘制低透明度作物名称水印。

**Architecture:** `site/app/map.js` 维护资源色表、农业资源键集合和金矿场别名；两条资源着色路径通过同一个梯度函数取得终点色。底图仍保存在现有图层缓存中。农业水印依赖视口和地图变换，因此在主画布每次绘制时叠加：加载地图数据时预计算战略区域全部陆地像素的中心，绘制时只选择包含当前作物的战略区域，并在屏幕坐标中进行碰撞省略。

**Tech Stack:** 原生 JavaScript、Canvas 2D、Node.js 静态检查、Playwright 浏览器回归。

---

### Task 1: 建立资源色表与水印行为的失败检查

**Files:**
- Create: `scripts/check_resource_map_colors.mjs`
- Create: `scripts/check_resource_map_colors_browser.mjs`
- Test: `scripts/check_resource_map_colors.mjs`

- [x] **Step 1: 新建静态检查并读取当前地图数据**

写入 `scripts/check_resource_map_colors.mjs`。检查从 `site/versions/1.13.9/data-regions.js` 读取 `window.VIC3_DATA_CHUNK`，从 `site/app/map.js` 读取模块源码，收集 `capped_resources`、`discoverable_resources` 与 `arable_resources` 的唯一资源键。文件必须包含以下基础结构：

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const mapSource = read("site/app/map.js");
const indexSource = read("site/index.html");
const dataSource = read("site/versions/1.13.9/data-regions.js");
const data = JSON.parse(dataSource.replace(/^window\\.VIC3_DATA_CHUNK\\s*=\\s*/, "").replace(/;\\s*$/, ""));
const resourceKeys = new Set(data.stateRegions.flatMap((stateRegion) => [
  ...(stateRegion.capped_resources || []),
  ...(stateRegion.discoverable_resources || []),
  ...(stateRegion.arable_resources || []),
].map((item) => item.key).filter(Boolean)));

for (const key of resourceKeys) {
  assert.match(mapSource, new RegExp(`"${key}"`), `resource color table must mention ${key}`);
}
assert.match(mapSource, /const RESOURCE_MAP_COLOR_ALIASES = new Map\\(\\[\\s*\\["building_gold_field", "building_gold_mine"\\]/, "gold field must inherit the gold mine color");
assert.match(mapSource, /const AGRICULTURAL_RESOURCE_KEYS = new Set\\(\\[/, "agricultural resource keys must be explicit");
assert.match(mapSource, /const AGRICULTURAL_RESOURCE_COLOR = "#416d36"/, "all agriculture must use the approved green endpoint");
assert.match(mapSource, /function resourceMapGradientColor\\(/, "both resource views need a shared gradient helper");
assert.match(mapSource, /function computeStrategicRegionMapCenters\\(/, "watermarks need strategic-region land centers");
assert.match(mapSource, /function drawAgriculturalResourceWatermarks\\(/, "agricultural watermarks need a dedicated draw pass");
assert.match(mapSource, /state\.mapMode !== "resourceSelection" \|\| !isAgriculturalResourceKey\(state\.mapSubject\)/, "watermarks must be limited to an agricultural resource selection");
assert.match(mapSource, /context\.measureText\(text\)/, "watermark collision must use measured text bounds");
assert.match(mapSource, /rectanglesOverlap\(/, "watermark collision must skip overlapping labels");
assert.match(indexSource, /app\/map\.js\?v=20260730-resource-map-colors1/, "main entry must invalidate the changed map script");

console.log(JSON.stringify({ resource_map_colors: "ok", resources: resourceKeys.size }, null, 2));

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\\uFEFF/, "");
}
```

- [x] **Step 2: 新建浏览器检查，预先捕获画布文字绘制**

写入 `scripts/check_resource_map_colors_browser.mjs`。用 Playwright 的 `context.addInitScript` 包装 `CanvasRenderingContext2D.prototype.fillText`，只记录等于“小麦农场”或“铁矿”的文字。打开 `#/region` 后点击 `data-resource-filter="building_wheat_farm"`，等待至少两次“小麦农场”文字绘制；再点击 `data-resource-filter="building_iron_mine"`，确认新一轮绘制没有“铁矿”水印。脚本必须使用以下核心逻辑，并把页面错误收集为失败：

```js
const browser = await chromium.launch({ headless: true, ...(chromePath ? { executablePath: chromePath } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => {
  window.__resourceMapTextCalls = [];
  const original = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function patchedFillText(text, ...args) {
    if (text === "小麦农场" || text === "铁矿") window.__resourceMapTextCalls.push(String(text));
    return original.call(this, text, ...args);
  };
});
const page = await context.newPage();
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(error.message));
await page.goto(`${baseUrl}#/region`, { waitUntil: "networkidle" });
await page.locator("[data-resource-filter='building_wheat_farm']").click();
await page.waitForFunction(() => window.__resourceMapTextCalls.filter((text) => text === "小麦农场").length >= 2);
const wheatCalls = await page.evaluate(() => window.__resourceMapTextCalls.filter((text) => text === "小麦农场").length);
await page.evaluate(() => { window.__resourceMapTextCalls = []; });
await page.locator("[data-resource-filter='building_iron_mine']").click();
await page.waitForTimeout(250);
assert.equal(await page.evaluate(() => window.__resourceMapTextCalls.includes("铁矿")), false, "non-agricultural iron must not draw a text watermark");
assert.ok(wheatCalls >= 2, "wheat must draw text watermarks in multiple strategic regions");
assert.deepEqual(errors, [], `page errors: ${errors.join(" | ")}`);
```

在同一脚本结尾关闭页面、上下文和浏览器，并输出 `resource_map_colors_browser: "ok"`。

- [x] **Step 3: 运行检查并确认当前实现失败**

运行：`node scripts/check_resource_map_colors.mjs`

预期：以 `resource color table must mention ...`、`gold field must inherit the gold mine color` 或 `watermarks need strategic-region land centers` 之一失败；浏览器检查暂不运行，因为当前页面尚没有可捕获的水印。

- [x] **Step 4: 提交失败检查**

不要单独提交预期失败的检查。保留它们，与 Task 2 和 Task 3 的最小实现一起提交，避免主分支出现失败提交。

### Task 2: 实现资源色表和共用梯度

**Files:**
- Modify: `site/app/map.js:690-810`
- Test: `scripts/check_resource_map_colors.mjs`

- [x] **Step 1: 在资源地图构建函数前定义颜色常量与帮助函数**

在 `buildSelectedResourceMapFeatures()` 前加入以下常量和函数。颜色表中的农业键全部引用同一个 `AGRICULTURAL_RESOURCE_COLOR`，金矿场通过别名解析到金矿；未在表内的资源继续沿用此前黄褐终点色。

```js
const RESOURCE_MAP_NEUTRAL_COLOR = "#f6d89a";
const RESOURCE_MAP_DEFAULT_COLOR = "#9b4a2f";
const AGRICULTURAL_RESOURCE_COLOR = "#416d36";
const AGRICULTURAL_RESOURCE_KEYS = new Set([
  "building_wheat_farm", "building_rye_farm", "building_rice_farm", "building_maize_farm",
  "building_millet_farm", "building_livestock_ranch", "building_vineyard", "building_coffee_plantation",
  "building_tea_plantation", "building_tobacco_plantation", "building_opium_plantation", "building_banana_plantation",
  "building_sugar_plantation", "building_silk_plantation", "building_cotton_plantation", "building_dye_plantation",
]);
const RESOURCE_MAP_COLOR_BY_KEY = new Map([
  ["building_coal_mine", "#596166"], ["building_iron_mine", "#557b91"], ["building_lead_mine", "#727884"],
  ["building_sulfur_mine", "#c69b26"], ["building_gold_mine", "#c9a34f"], ["building_fishing_wharf", "#3d8293"],
  ["building_whaling_station", "#42667b"], ["building_logging_camp", "#5e8750"], ["building_rubber_plantation", "#657b3a"],
  ["building_oil_rig", "#47495d"],
  ...[...AGRICULTURAL_RESOURCE_KEYS].map((key) => [key, AGRICULTURAL_RESOURCE_COLOR]),
]);
const RESOURCE_MAP_COLOR_ALIASES = new Map([
  ["building_gold_field", "building_gold_mine"],
]);

function resourceMapColor(resourceKey) {
  const resolvedKey = RESOURCE_MAP_COLOR_ALIASES.get(resourceKey) || resourceKey;
  return RESOURCE_MAP_COLOR_BY_KEY.get(resolvedKey) || RESOURCE_MAP_DEFAULT_COLOR;
}

function isAgriculturalResourceKey(resourceKey) {
  return AGRICULTURAL_RESOURCE_KEYS.has(resourceKey);
}

function resourceMapGradientColor(resourceKey, value, maxValue) {
  const ratio = Math.sqrt(Number(value || 0) / Math.max(Number(maxValue || 0), 1));
  return interpolateColor(RESOURCE_MAP_NEUTRAL_COLOR, resourceMapColor(resourceKey), ratio);
}
```

- [x] **Step 2: 替换单项资源地图的固定黄褐插值**

在 `buildResourceMapFeatures()` 中保留海域和空资源分支，将非空资源的颜色表达式替换为：

```js
const color = isSea
  ? MAP_SEA_COLOR
  : valueInfo.value > 0
    ? resourceMapGradientColor(subject, valueInfo.value, maxValue)
    : "#eee9df";
```

这样下拉资源模式会使用对应资源主色；`building_gold_field` 自动显示金色，未知未来资源继续使用原有黄褐梯度。

- [x] **Step 3: 替换地域资源筛选地图的固定黄褐插值**

在 `buildSelectedResourceMapFeatures()` 的 `selectedFilters` 后加入：

```js
const selectedResourceKey = selectedFilters.length === 1
  ? (selectedFilters[0].resources || selectedFilters[0].arableResources || [])[0] || selectedFilters[0].key
  : "";
```

将非空资源的颜色表达式替换为：

```js
? resourceMapGradientColor(selectedResourceKey, valueInfo.total, maxValue)
```

地域板块的现有交互一次只保留一个资源筛选；若外部状态注入多个筛选，空键会通过 `resourceMapColor("")` 回退为原来的黄褐色，避免把多资源总量误标成单项资源颜色。

- [x] **Step 4: 运行静态检查并确认颜色契约通过**

运行：`node scripts/check_resource_map_colors.mjs`

预期：输出包含 `resource_map_colors: "ok"` 和 `resources: 27`。如果资源计数变化，先检查数据版本是否改变，再更新颜色表和规格，不以降低断言为方式通过检查。

### Task 3: 预计算战略区域几何中心并绘制农业水印

**Files:**
- Modify: `site/app/runtime.js:78-105`
- Modify: `site/app/data.js:310-325`
- Modify: `site/app/map.js:213-235, 1052-1085, 1230-1264`
- Test: `scripts/check_resource_map_colors.mjs`
- Test: `scripts/check_resource_map_colors_browser.mjs`

- [x] **Step 1: 为地图运行时状态加入并重置战略区域中心缓存**

在 `mapRuntime` 的 `stateKeysByIndex` 后加入 `strategicRegionCenters: new Map(),`。在 `resetMapRuntime()` 中于清空 `stateKeysByIndex` 后加入：

```js
mapRuntime.strategicRegionCenters = new Map();
```

这保证切换数据集后不会将旧地图尺寸和旧州地区索引的中心用于新数据集。

- [x] **Step 2: 在地图索引解码后计算全部陆地战略区域中心**

在 `ensureMapLoaded()` 中，紧接 `mapRuntime.stateCenters = computeMapStateCenters(...)` 后加入：

```js
mapRuntime.strategicRegionCenters = computeStrategicRegionMapCenters(
  mapRuntime.pixelStateIndexes,
  mapRuntime.width,
  mapRuntime.stateKeysByIndex,
);
```

在 `computeMapStateCenters()` 后加入 `computeStrategicRegionMapCenters()`。函数分两次扫描像素：第一次按州地区的 `strategic_regions` 对全部非海域像素累加横纵坐标和面积；第二次为每个战略区域寻找距其算术平均坐标最近的有效陆地像素。函数返回 `Map<战略区域键, { x, y, count }>`。实现必须包含以下完整逻辑骨架：

```js
function computeStrategicRegionMapCenters(indexes, width, stateKeysByIndex) {
  const totals = new Map();
  const regionKeysByStateIndex = stateKeysByIndex.map((stateKey) => {
    const stateRegion = byStateRegion.get(stateKey);
    if (!stateRegion || isSeaStateRegion(stateRegion)) return [];
    return (stateRegion.strategic_regions || [])
      .map((ref) => byStrategicRegion.get(ref.key))
      .filter((region) => region && !isSeaStrategicRegion(region))
      .map((region) => region.key);
  });
  for (let pixel = 0; pixel < indexes.length; pixel += 1) {
    const regionKeys = regionKeysByStateIndex[indexes[pixel]] || [];
    if (!regionKeys.length) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    for (const key of regionKeys) {
      const total = totals.get(key) || { x: 0, y: 0, count: 0 };
      total.x += x;
      total.y += y;
      total.count += 1;
      totals.set(key, total);
    }
  }
  const centers = new Map([...totals].map(([key, total]) => [key, { x: total.x / total.count, y: total.y / total.count, count: total.count, distance: Infinity }]));
  for (let pixel = 0; pixel < indexes.length; pixel += 1) {
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    for (const key of regionKeysByStateIndex[indexes[pixel]] || []) {
      const center = centers.get(key);
      const distance = (center.x - x) ** 2 + (center.y - y) ** 2;
      if (distance < center.distance) Object.assign(center, { x, y, distance });
    }
  }
  for (const center of centers.values()) delete center.distance;
  return centers;
}
```

- [x] **Step 3: 构造匹配战略区域并在主画布叠加文字**

在 `paintMapCanvasTarget()` 的地图复制循环后、`drawMapLabels()` 前加入：

```js
if (drawLabels) drawAgriculturalResourceWatermarks(context, copyRange, transform, rect);
if (drawLabels) drawMapLabels(context, copyRange, transform);
```

在 `drawMapLabels()` 前加入以下函数：

```js
function drawAgriculturalResourceWatermarks(context, copyRange, transform, viewportRect) {
  if (state.mapMode !== "resourceSelection" || !isAgriculturalResourceKey(state.mapSubject)) return;
  const text = mapSubjectLabel();
  if (!text || !mapRuntime.strategicRegionCenters?.size) return;
  const matchingRegions = new Set();
  for (const stateRegion of stateRegions) {
    if (stateRegionResourceValue(stateRegion, state.mapSubject).value <= 0) continue;
    for (const ref of stateRegion.strategic_regions || []) matchingRegions.add(ref.key);
  }
  const inverseScale = 1 / Math.max(transform.scale, 0.001);
  const fontSize = 19 * inverseScale;
  context.save();
  context.font = `800 ${fontSize}px ${MAP_LABEL_FONT_FAMILY}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  const textWidth = context.measureText(text).width * transform.scale;
  const textHeight = 23;
  const occupied = [];
  const candidates = [...matchingRegions]
    .map((key) => ({ key, center: mapRuntime.strategicRegionCenters.get(key) }))
    .filter((item) => item.center)
    .sort((a, b) => b.center.count - a.center.count || a.key.localeCompare(b.key));
  for (const candidate of candidates) {
    for (let copy = copyRange.start; copy <= copyRange.end; copy += 1) {
      const x = candidate.center.x + copy * mapRuntime.width;
      const y = candidate.center.y;
      const screenX = transform.x + x * transform.scale;
      const screenY = transform.y + y * transform.scale;
      const bounds = { left: screenX - textWidth / 2 - 8, top: screenY - textHeight / 2 - 5, right: screenX + textWidth / 2 + 8, bottom: screenY + textHeight / 2 + 5 };
      if (bounds.right < 0 || bounds.left > viewportRect.width || bounds.bottom < 0 || bounds.top > viewportRect.height) continue;
      if (occupied.some((other) => rectanglesOverlap(bounds, other))) continue;
      occupied.push(bounds);
      context.save();
      context.translate(x, y);
      context.rotate(-0.18);
      context.globalAlpha = 0.42;
      context.fillStyle = "#f8faef";
      context.fillText(text, 0, 0);
      context.restore();
    }
  }
  context.restore();
}

function rectanglesOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
```

文字处于主画布的地图变换中，因此平移、缩放、横向环绕副本和窗口尺寸变化都会重新计算位置；它不进入 `layerCanvas`，不能污染底图缓存。地区储量数字仍在 `drawMapLabels()` 中后绘制，保持在水印上方。

- [x] **Step 4: 运行静态与浏览器检查**

先启动本地站点：`node scripts/serve_site.mjs site 8876`。

另开终端运行：

```powershell
node scripts/check_resource_map_colors.mjs
node scripts/check_resource_map_colors_browser.mjs http://127.0.0.1:8876/index.html
```

预期：静态检查输出 `resources: 27`；浏览器检查输出 `resource_map_colors_browser: "ok"`，小麦有多处水印，铁矿没有水印，且没有控制台或页面错误。

### Task 4: 更新缓存版本、回归并记录结果

**Files:**
- Modify: `site/index.html:304`
- Modify: `docs/worklog/2026-07-30.md`
- Modify: `WORKLOG.md`
- Verify: `Victorian Century Database/` generated standalone copy

- [x] **Step 1: 更新主站地图脚本缓存参数**

将入口中的地图脚本替换为：

```html
<script src="app/map.js?v=20260730-resource-map-colors1"></script>
```

不要改变同一入口中当前未提交的 `components.js` 版本参数。提交时使用 `git add -p site/index.html`，只暂存地图脚本这一行。

- [x] **Step 2: 运行完整静态回归**

运行：

```powershell
node --check site/app/map.js
node --check site/app/runtime.js
node --check site/app/data.js
node scripts/check_resource_map_colors.mjs
node scripts/check_region_map_interaction.mjs
node scripts/check_country_map_selection.mjs
git diff --check
```

预期：所有命令退出码为 `0`；既有地域、国家地图检查继续分别输出 `region_map_interaction: "ok"` 和 `country_map_selection: "ok"`。

- [x] **Step 3: 手工浏览器回归农业、矿产与交互**

在 `http://127.0.0.1:8876/index.html#/region` 中依次选择小麦、畜牧场、铁矿和金矿。确认小麦与畜牧场均为绿色梯度且显示对应作物文字，铁矿为蓝灰梯度且无文字，金矿为金色梯度。缩小到完整世界视图后确认重叠水印被省略，放大后可见更多。拖动地图跨越横向接缝，确认水印随重复地图显示；移动鼠标确认提示框仍出现，单击和双击地区仍保持现有选中与详情行为。

- [x] **Step 4: 同步并验证 Victorian Century 生成站点**

运行：`node scripts/build_victorian_century_site.mjs --skip-vc-assets`。

确认 `Victorian Century Database/app/map.js` 与 `site/app/map.js` 的 SHA-256 相同，再用本地服务打开 Victorian Century 入口并选择一个农业资源。`bg_monuments` 必须继续使用黄褐备用梯度，农业资源继续使用绿色与水印。生成目录和 `site/vc/` 受 `.gitignore` 管理，不暂存它们。

- [x] **Step 5: 写入工作记录并提交功能**

在 `docs/worklog/2026-07-30.md` 追加一段，记录颜色表、金矿场继承、农业绿色、战略区域几何中心水印、碰撞省略、静态与浏览器检查结果。将根 `WORKLOG.md` 的“当前任务”替换为完成状态，并在详细记录列表添加 `2026-07-30` 资源地图条目。

暂存时不得包含当前工作区已有的 `site/app/components.js`、`scripts/check_discoverable_resource_totals.mjs`、`Victorian/`、`screenshots/` 或 `scripts/__pycache__/` 改动。地图文件含有用户已有的可发现资源总量修改，因此使用交互式暂存只选本计划新增色表与水印区块：

```powershell
git add scripts/check_resource_map_colors.mjs scripts/check_resource_map_colors_browser.mjs site/app/runtime.js site/app/data.js docs/worklog/2026-07-30.md WORKLOG.md
git add -p site/app/map.js
git add -p site/index.html
git add docs/superpowers/plans/2026-07-30-resource-map-colors-and-agricultural-watermarks.md
git diff --cached --check
git diff --cached --stat
git commit -m "feat: color resource maps by resource"
```

预期：暂存差异只包含资源颜色、水印、两份新检查、缓存参数、工作记录和计划文档；可发现资源总量的既有改动保持未暂存。
