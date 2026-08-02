# 资源地图实心线性色阶实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 资源地图以完全不透明的资源专属线性色阶表达储量，并移除资源地图中的羊皮纸底图与黄色无资源陆地。

**Architecture:** `site/app/map.js` 保持两个资源视图共用的取色入口，但为所有资源定义淡色端与标准色，采用 `value / maxValue` 线性比例。地图层根据资源模式选取不透明度，绘制目标根据资源模式改用浅蓝海洋底色并跳过纸张图。`scripts/check_resource_map_colors.mjs` 固化源代码契约，`scripts/check_resource_map_colors_browser.mjs` 从浏览器中的画布调用记录真实像素 alpha 与取色结果。

**Tech Stack:** 原生浏览器 Canvas、JavaScript ES modules、Node.js `assert`、Playwright、Victorian Century 站点生成脚本。

---

### Task 1: 定义资源专属线性色阶的失败契约

**Files:**

- Modify: `scripts/check_resource_map_colors.mjs:8-72`
- Test: `scripts/check_resource_map_colors.mjs`

- [x] **Step 1: 将通用黄色淡色端和 232 alpha 断言替换为资源专属、线性与实心约束。**

  在现有 `agriculturalGradients` 后增加以下非农业资源渐变，并用合并后的映射检查 1.13.9 数据的 27 个资源键：

  ```js
  const nonAgriculturalGradients = new Map([
    ["building_coal_mine", { low: "#c6ced1", high: "#596166" }],
    ["building_iron_mine", { low: "#cde0eb", high: "#557b91" }],
    ["building_lead_mine", { low: "#d3d7df", high: "#727884" }],
    ["building_sulfur_mine", { low: "#f0e4ac", high: "#c69b26" }],
    ["building_gold_mine", { low: "#f2dfaa", high: "#c9a34f" }],
    ["building_fishing_wharf", { low: "#b8dce1", high: "#3d8293" }],
    ["building_whaling_station", { low: "#c0d1dc", high: "#42667b" }],
    ["building_logging_camp", { low: "#c9dbbd", high: "#5e8750" }],
    ["building_rubber_plantation", { low: "#ced7ab", high: "#657b3a" }],
    ["building_oil_rig", { low: "#c5c7d2", high: "#47495d" }],
  ]);
  const resourceGradients = new Map([...agriculturalGradients, ...nonAgriculturalGradients]);
  for (const [key, { low, high }] of resourceGradients) {
    assert.match(mapSource, new RegExp(`\\["${key}", \\{ low: "${low}", high: "${high}" \\}\\]`), `${key} must define its own linear color endpoints`);
  }
  for (const key of resourceKeys) {
    const resolvedKey = key === "building_gold_field" ? "building_gold_mine" : key;
    assert(resourceGradients.has(resolvedKey), `${key} must resolve to a dedicated gradient`);
  }
  ```

  删除 `RESOURCE_MAP_NEUTRAL_COLOR = "#f6d89a"` 的断言，新增下列断言：

  ```js
  assert.match(mapSource, /const RESOURCE_MAP_EMPTY_LAND_COLOR = "#e9edeb"/, "resource maps must use a cool-gray empty land color");
  assert.match(mapSource, /const RESOURCE_MAP_COMBINED_GRADIENT = \{ low: "#c9d6de", high: "#58788a" \}/, "multi-resource selections must use a dedicated cool-blue-gray gradient");
  assert.match(functionSource(mapSource, "resourceMapGradientColor"), /Number\(value \|\| 0\) \/ Math\.max\(Number\(maxValue \|\| 0\), 1\)/, "resource gradients must use a linear value ratio");
  assert.doesNotMatch(functionSource(mapSource, "resourceMapGradientColor"), /Math\.sqrt/, "resource gradients must not use square-root scaling");
  assert.match(runtimeSource, /const MAP_RESOURCE_LAND_ALPHA = 255;/, "resource maps must draw land fully opaque");
  assert.match(functionSource(mapSource, "paintMapCanvasTarget"), /resourceMapUsesSolidBase\(\)[\s\S]*MAP_SEA_COLOR/, "resource maps must paint a sea-blue base");
  assert.match(functionSource(mapSource, "paintMapCanvasTarget"), /if \(mapRuntime\.paperMapImage && !resourceMapUsesSolidBase\(\)\)/, "resource maps must skip the paper background");
  ```

- [x] **Step 2: 运行静态检查并确认旧实现失败。**

  Run: `node scripts/check_resource_map_colors.mjs`

  Expected: 失败，至少报告铁矿淡色端、线性比例、`MAP_RESOURCE_LAND_ALPHA = 255` 和跳过纸张底图尚未满足。

- [x] **Step 3: 提交失败契约。**

  ```powershell
  git add scripts/check_resource_map_colors.mjs
  git commit -m "test: define solid resource map color scale"
  ```

### Task 2: 实现资源专属实心线性色阶与冷灰空地

**Files:**

- Modify: `site/app/runtime.js:63-71`
- Modify: `site/app/map.js:737-792,795-840,870-900,984-990,1144-1176`
- Modify: `Victorian Century Database/app/runtime.js:63-71`
- Modify: `Victorian Century Database/app/map.js:737-792,795-840,870-900,984-990,1144-1176`
- Test: `scripts/check_resource_map_colors.mjs`

- [x] **Step 1: 增加资源地图专用颜色常量和 255 alpha。**

  在 `site/app/runtime.js` 保留 `MAP_SEA_COLOR` 和其他非资源模式常量，将资源陆地 alpha 改为：

  ```js
  const MAP_RESOURCE_LAND_ALPHA = 255;
  ```

  在 `site/app/map.js` 的资源颜色定义前增加：

  ```js
  const RESOURCE_MAP_EMPTY_LAND_COLOR = "#e9edeb";
  const RESOURCE_MAP_COMBINED_GRADIENT = { low: "#c9d6de", high: "#58788a" };
  ```

  删除 `RESOURCE_MAP_NEUTRAL_COLOR`。把现有 `RESOURCE_MAP_COLOR_BY_KEY` 转换为完整的 `RESOURCE_MAP_GRADIENT_BY_KEY`，农业保留既有 16 组颜色，非农业使用 Task 1 中的 10 组颜色。删除独立的 `RESOURCE_MAP_COLOR_BY_KEY`，并将 `resourceMapColor(resourceKey)` 改为返回 `resourceMapGradient(resourceKey).high`。

- [x] **Step 2: 改为线性取色，并为多资源筛选使用组合色阶。**

  使用以下函数替换现有 `resourceMapGradient()` 与 `resourceMapGradientColor()`：

  ```js
  function resourceMapGradient(resourceKey) {
    return RESOURCE_MAP_GRADIENT_BY_KEY.get(resolveResourceMapColorKey(resourceKey)) || RESOURCE_MAP_COMBINED_GRADIENT;
  }

  function resourceMapGradientColor(resourceKey, value, maxValue) {
    const ratio = Number(value || 0) / Math.max(Number(maxValue || 0), 1);
    const gradient = resourceMapGradient(resourceKey);
    return interpolateColor(gradient.low, gradient.high, ratio);
  }
  ```

  在 `buildSelectedResourceMapFeatures()` 的 `selectedResourceKey` 计算后增加：

  ```js
  const colorResourceKey = selectedFilters.length === 1 ? selectedResourceKey : "";
  ```

  并将循环中的 `resourceMapGradientColor(selectedResourceKey, valueInfo.total, maxValue)` 替换为：

  ```js
  resourceMapGradientColor(colorResourceKey, valueInfo.total, maxValue)
  ```

  将两个资源构建函数中无资源陆地的 `"#eee9df"` 替换为 `RESOURCE_MAP_EMPTY_LAND_COLOR`。

- [x] **Step 3: 将资源模式的全部陆地改为不透明。**

  在 `mapPixelAlpha()` 最前面加入：

  ```js
  if (["resource", "resourceSelection"].includes(state.mapMode)) {
    return stateLayer.sea[stateIndex] ? MAP_SEA_ALPHA : MAP_RESOURCE_LAND_ALPHA;
  }
  ```

  保留后续的海洋、筛选可见性与 `MAP_MUTED_ALPHA` 逻辑给其他地图模式使用。资源模式中的不可见陆地随资源地图统一使用 `MAP_RESOURCE_LAND_ALPHA`。

- [x] **Step 4: 将资源地图画布改为海洋浅蓝底并跳过纸张图。**

  在 `paintMapCanvasTarget()` 前定义：

  ```js
  function resourceMapUsesSolidBase() {
    return ["resource", "resourceSelection"].includes(state.mapMode);
  }
  ```

  将底色和纸张绘制替换为：

  ```js
  context.fillStyle = resourceMapUsesSolidBase() ? MAP_SEA_COLOR : "#d7c2a4";
  context.fillRect(0, 0, width, height);
  // …保持 transform 与 copyRange 的现有计算…
  for (let copy = copyRange.start; copy <= copyRange.end; copy += 1) {
    if (mapRuntime.paperMapImage && !resourceMapUsesSolidBase()) {
      context.drawImage(mapRuntime.paperMapImage, copy * mapRuntime.width, 0, mapRuntime.width, mapRuntime.height);
    }
    context.drawImage(mapRuntime.layerCanvas, copy * mapRuntime.width, 0);
  }
  ```

- [x] **Step 5: 运行静态检查并确认通过。**

  Run: `node scripts/check_resource_map_colors.mjs`

  Expected: 输出包含 `"resource_map_colors": "ok"` 与 `"resources": 27`。

- [x] **Step 6: 将同一组地图代码同步到 Victorian Century。**

  将 Task 2 的常量、完整资源渐变表、`resourceMapGradient()`、`resourceMapGradientColor()`、`buildSelectedResourceMapFeatures()`、`buildResourceMapFeatures()`、`mapPixelAlpha()`、`resourceMapUsesSolidBase()` 与 `paintMapCanvasTarget()` 的同一代码块，应用到 `Victorian Century Database/app/map.js`。将 `MAP_RESOURCE_LAND_ALPHA = 255` 同步到 `Victorian Century Database/app/runtime.js`。

  不运行 `scripts/build_victorian_century_site.mjs`。当前 `site/app/components.js` 有用户尚未提交的可发现资源总量修改；全量生成会无关地复制到 Victorian Century 目录。

- [x] **Step 7: 提交运行时代码。**

  ```powershell
  git add site/app/runtime.js site/app/map.js
  git commit -m "feat: use solid linear resource map colors"
  ```

### Task 3: 扩展浏览器检查到实心图层与铁矿淡蓝色阶

**Files:**

- Modify: `scripts/check_resource_map_colors_browser.mjs:14-54`
- Test: `scripts/check_resource_map_colors_browser.mjs`

- [x] **Step 1: 在画布图层写入时记录资源模式的像素 alpha 和颜色。**

  在现有 `context.addInitScript()` 中保留 `fillText` 包装，并在其后加入：

  ```js
  window.__resourceMapLayers = [];
  const originalPutImageData = CanvasRenderingContext2D.prototype.putImageData;
  CanvasRenderingContext2D.prototype.putImageData = function patchedPutImageData(imageData, ...args) {
    if (imageData?.width === 4096 && imageData?.height === 1808) {
      const pixels = imageData.data;
      const alpha = new Set();
      let ironYellowPixels = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3]) alpha.add(pixels[index + 3]);
        if (pixels[index + 3] === 255 && pixels[index] > 225 && pixels[index + 1] > 195 && pixels[index + 2] < 180) ironYellowPixels += 1;
      }
      window.__resourceMapLayers.push({ alpha: [...alpha].sort((a, b) => a - b), ironYellowPixels });
    }
    return originalPutImageData.call(this, imageData, ...args);
  };
  ```

- [x] **Step 2: 为小麦和铁矿各加入实心与颜色断言。**

  小麦筛选后读取最后一个画布记录，断言：

  ```js
  const wheatLayer = await page.evaluate(() => window.__resourceMapLayers.at(-1));
  assert(wheatLayer.alpha.includes(255), "wheat resource layer must contain opaque land pixels");
  assert.equal(wheatLayer.alpha.includes(232), false, "wheat resource layer must not retain the former alpha");
  ```

  切换铁矿前清空 `window.__resourceMapLayers`。铁矿筛选后断言：

  ```js
  const ironLayer = await page.evaluate(() => window.__resourceMapLayers.at(-1));
  assert(ironLayer.alpha.includes(255), "iron resource layer must contain opaque land pixels");
  assert.equal(ironLayer.ironYellowPixels, 0, "iron resource layer must not use the former yellow starting color");
  ```

  保留既有图标、中文资源名、版本、无水印、取消筛选与页面错误断言。输出对象中增加 `wheatLayer` 与 `ironLayer`。

- [x] **Step 3: 在临时本地服务上运行浏览器检查并确认旧实现失败。**

  ```powershell
  $resourceMapServer = Start-Process -FilePath node -ArgumentList 'scripts/serve_site.mjs','site','8876' -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -PassThru
  $env:NODE_PATH = 'C:\Users\SamuY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
  $env:VC_CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
  try { node scripts/check_resource_map_colors_browser.mjs 'http://127.0.0.1:8876/index.html' } finally { Stop-Process -Id $resourceMapServer.Id }
  ```

  Expected: Task 2 已完成时通过；在 Task 2 之前会因 alpha 或铁矿黄色断言失败。

- [x] **Step 4: 提交浏览器回归检查。**

  ```powershell
  git add scripts/check_resource_map_colors_browser.mjs
  git commit -m "test: verify solid resource map layers"
  ```

### Task 4: 同步 Victorian Century、完整验证与记录

**Files:**

- Modify: `site/index.html:7,304`
- Modify: `site/styles.css:1-3`
- Modify: `Victorian Century Database/index.html:7,304`
- Modify: `Victorian Century Database/styles.css:1-3`
- Modify: `docs/worklog/2026-07-31.md`
- Test: `scripts/check_resource_map_colors.mjs`
- Test: `scripts/check_resource_map_colors_browser.mjs`
- Test: `scripts/check_region_map_interaction.mjs`
- Test: `scripts/check_country_map_selection.mjs`

- [x] **Step 1: 更新资源地图入口缓存参数。**

  在 `site/index.html` 把样式与地图脚本版本改为同一新标识：

  ```html
  <link rel="stylesheet" href="styles.css?v=20260731-resource-map-solid-linear1">
  <script src="app/map.js?v=20260731-resource-map-solid-linear1"></script>
  ```

  在 `site/styles.css` 中同步：

  ```css
  @import url("styles/map.css?v=20260731-resource-map-solid-linear1");
  ```

  将 Task 1 中静态检查的版本断言更新为这两个入口字符串。

- [x] **Step 2: 在主站运行完整静态与浏览器验证。**

  ```powershell
  $env:NODE_PATH = 'C:\Users\SamuY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
  $env:VC_CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
  node --check site/app/map.js
  node --check site/app/runtime.js
  node scripts/check_resource_map_colors.mjs
  node scripts/check_region_map_interaction.mjs
  node scripts/check_country_map_selection.mjs
  $resourceMapServer = Start-Process -FilePath node -ArgumentList 'scripts/serve_site.mjs','site','8876' -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -PassThru
  try { node scripts/check_resource_map_colors_browser.mjs 'http://127.0.0.1:8876/index.html' } finally { Stop-Process -Id $resourceMapServer.Id }
  ```

  Expected: 所有静态脚本成功；浏览器输出 `"resource_map_colors_browser": "ok"`，并包含小麦与铁矿的 `255` alpha 记录，铁矿黄色像素为 `0`。

- [x] **Step 3: 在 Victorian Century 站点上复核已同步的地图代码。**

  ```powershell
  $mainHash = (Get-FileHash 'site\app\map.js' -Algorithm SHA256).Hash
  $vcHash = (Get-FileHash 'Victorian Century Database\app\map.js' -Algorithm SHA256).Hash
  if ($mainHash -ne $vcHash) { throw 'Victorian Century map.js 与主站不同步' }
  $vcServer = Start-Process -FilePath node -ArgumentList 'scripts/serve_site.mjs','Victorian Century Database','8877' -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -PassThru
  try { node scripts/check_resource_map_colors_browser.mjs 'http://127.0.0.1:8877/index.html' } finally { Stop-Process -Id $vcServer.Id }
  ```

  Expected: 两份 `map.js` SHA-256 相同；VC 浏览器检查通过。全量生成刻意不执行，以保留当前未提交的 `components.js` 改动边界。

- [x] **Step 4: 追加工作记录。**

  在 `docs/worklog/2026-07-31.md` 追加本轮已确认事项：资源地图改为线性色阶与 255 alpha、纸张底图仅在非资源地图使用、无资源陆地为 `#e9edeb`、铁矿从 `#cde0eb` 过渡到 `#557b91`、以及主站和 VC 的实际检查结果与 SHA-256。

- [x] **Step 5: 检查差异并只提交本轮文件。**

  ```powershell
  git diff --check
  git add site/app/runtime.js site/styles.css scripts/check_resource_map_colors.mjs scripts/check_resource_map_colors_browser.mjs docs/worklog/2026-07-31.md
  git add -p site/app/map.js
  git add -p site/index.html
  git diff --cached --check
  git commit -m "feat: render resource maps with solid linear colors"
  ```

  提交前确认不包含当前工作区已有的 `site/app/components.js`、其中的 `discoverableResourceAmount` 调整、`scripts/check_discoverable_resource_totals.mjs`、`Victorian`、`screenshots/`、`scripts/__pycache__/`，以及任何与本计划无关的改动。
