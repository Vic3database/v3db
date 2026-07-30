# 资源地图自然色与上下文栏实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 资源地图按资源显示清晰可辨的自然色；农业资源移除画布文字水印；重置地图按钮右侧显示当前资源的建筑图标、中文名称与资料库版本；资源视图的陆地着色提高不透明度，避免低储量区域被底图影响而显得发黄。

**架构：** `site/app/map.js` 维护资源颜色终点与农业资源各自的低值、高值色，两个资源地图着色路径继续共用 `resourceMapGradientColor()`。资源上下文栏由 `renderMapControls()` 按 `state.mapMode` 与 `state.mapSubject` 渲染，建筑图标沿用 `buildingIconFileByKey`；没有图标的资源改用该资源主色圆点。地图画布不再计算战略区域中心，也不再绘制农业文字。`mapPixelAlpha()` 只在资源相关模式提高可见陆地的不透明度。

**技术栈：** 原生 JavaScript、Canvas 2D、CSS、Node.js 静态检查、Playwright 浏览器回归。

**范围：** 仅改地域资源地图与普通资源地图的呈现。资源列表、筛选点击逻辑、地图提示、其他地图模式和现有可发现资源总量改动均不在本次范围内。

---

### Task 1：先更新回归检查，使现状明确失败

**文件：**
- 修改：`scripts/check_resource_map_colors.mjs`
- 修改：`scripts/check_resource_map_colors_browser.mjs`
- 测试：`scripts/check_resource_map_colors.mjs`
- 测试：`scripts/check_resource_map_colors_browser.mjs`

- [ ] **Step 1：把静态检查改成新的颜色、上下文栏和无水印契约。**

保留脚本读取 `site/versions/1.13.9/data-regions.js` 并收集 `capped_resources`、`discoverable_resources`、`arable_resources` 全部资源键的逻辑，继续确认每个键都能在 `site/app/map.js` 的颜色定义中找到。将原来要求农业统一绿色、要求战略区域中心和水印函数的断言替换为以下契约：

```js
const agriculturalGradients = new Map([
  ["building_wheat_farm", { low: "#f0dea8", high: "#c69b32" }],
  ["building_rye_farm", { low: "#e0ca98", high: "#8d713d" }],
  ["building_rice_farm", { low: "#cce7c7", high: "#4f9b72" }],
  ["building_maize_farm", { low: "#f2dfa4", high: "#d59d27" }],
  ["building_millet_farm", { low: "#e7d2a7", high: "#b88735" }],
  ["building_livestock_ranch", { low: "#dacdb9", high: "#87643e" }],
  ["building_vineyard", { low: "#ddc7df", high: "#7e4b86" }],
  ["building_coffee_plantation", { low: "#ddc8b5", high: "#765039" }],
  ["building_tea_plantation", { low: "#c6e2c5", high: "#3d7e4d" }],
  ["building_tobacco_plantation", { low: "#e7caa2", high: "#a66e37" }],
  ["building_opium_plantation", { low: "#e8c5d6", high: "#a85e83" }],
  ["building_banana_plantation", { low: "#efe9ab", high: "#b7a92d" }],
  ["building_sugar_plantation", { low: "#cae1bf", high: "#72a05e" }],
  ["building_silk_plantation", { low: "#e7d8e3", high: "#b27fa9" }],
  ["building_cotton_plantation", { low: "#deecf1", high: "#8baebb" }],
  ["building_dye_plantation", { low: "#c5d0ec", high: "#4c5ea7" }],
]);

for (const [key, { low, high }] of agriculturalGradients) {
  assert.match(mapSource, new RegExp(`\\["${key}", \\{ low: "${low}", high: "${high}" \\}\\]`));
}
```

补充以下断言：金矿场仍通过 `RESOURCE_MAP_COLOR_ALIASES` 继承金矿颜色；默认低值色仍为 `#f6d89a`；`resourceMapGradientColor()` 仍是两种资源地图共用的插值入口；`drawAgriculturalResourceWatermarks`、`computeStrategicRegionMapCenters`、`strategicRegionCenters`、`rectanglesOverlap`、`AGRICULTURAL_RESOURCE_COLOR` 和 `AGRICULTURAL_RESOURCE_NEUTRAL_COLOR` 均不再出现。检查 `site/index.html` 有 `mapResourceContext`，检查 `site/app/runtime.js` 查询该元素，检查 `site/app/map.js` 有 `renderMapResourceContext()` 与无图标时的 `map-resource-context-swatch` 分支。检查 `MAP_RESOURCE_LAND_ALPHA = 232`，并确认资源模式分支才使用该常量。最后把两个入口缓存参数分别固定为 `styles.css?v=20260731-resource-map-context1` 与 `app/map.js?v=20260731-resource-map-natural-colors1`。

- [ ] **Step 2：把浏览器检查改为验证工具栏上下文与无画布水印。**

保留 Playwright 的页面错误收集。通过 `context.addInitScript()` 包装 `CanvasRenderingContext2D.prototype.fillText`，只记录文本为“`小麦农场`”或“`铁矿`”的调用。打开 `#/region`，选择 `building_wheat_farm` 后等待 `#mapResourceContext` 可见，验证其文本同时包含“小麦农场”和当前 `data.meta.victoria3_version`，且内部图片地址以 `assets/buildings/wheat_farm.png` 结尾。等待 300 毫秒后，断言画布记录不包含“小麦农场”。

改选 `building_iron_mine`，验证上下文文本改为“铁矿”、图片地址改为 `assets/buildings/iron_mine.png`，并断言画布记录不包含“铁矿”。再次点击铁矿筛选，等待上下文栏隐藏，确认取消资源选择后不会残留旧资源信息。脚本继续断言没有页面错误，并输出资源名称、图标地址与 `resource_map_colors_browser: "ok"`。

- [ ] **Step 3：运行检查，确认现有实现按预期失败。**

运行：

```powershell
node scripts/check_resource_map_colors.mjs
```

预期在新的渐变颜色、上下文栏、无水印或资源不透明度契约处失败。现有浏览器检查依赖将要新增的 `#mapResourceContext`，不在此时运行。保留测试文件，不单独提交失败状态。

### Task 2：删除画布水印并加入当前资源上下文栏

**文件：**
- 修改：`site/index.html:52-66,7,304`
- 修改：`site/app/runtime.js:80-105,739-745`
- 修改：`site/app/data.js:310-322`
- 修改：`site/app/map.js:1-25,225-240,1180-1192,1335-1405`
- 修改：`site/styles/map.css`
- 测试：`scripts/check_resource_map_colors_browser.mjs`

- [ ] **Step 1：在重置按钮后放置隐藏的上下文容器。**

在 `site/index.html` 的 `#mapFitWidthButton` 紧后添加：

```html
<span id="mapResourceContext" class="map-resource-context" aria-live="polite" hidden></span>
```

容器位于地图工具栏内，因此图标位于重置按钮与资源名称之间。同步将样式表缓存参数改为 `20260731-resource-map-context1`，地图脚本参数改为 `20260731-resource-map-natural-colors1`。该文件已有用户未提交的 `components.js` 缓存参数变更，提交时只能暂存上述两行和容器行。

- [ ] **Step 2：移除战略区域中心缓存与水印绘制路径。**

删除 `site/app/runtime.js` 中 `mapRuntime.strategicRegionCenters` 初始化，并删除 `site/app/data.js` 的重置赋值。删除 `ensureMapLoaded()` 中 `computeStrategicRegionMapCenters()` 调用及其完整函数定义。删除 `paintMapCanvasTarget()` 中 `drawAgriculturalResourceWatermarks()` 调用，连同 `drawAgriculturalResourceWatermarks()`、`rectanglesOverlap()` 与仅为它们服务的农业键判断函数一起移除。保留 `drawMapLabels()` 的数值标注、命中检测和地图缓存流程。

- [ ] **Step 3：在运行时元素表和地图控制器中渲染上下文。**

在 `els` 中紧跟 `mapFitWidthButton` 添加：

```js
mapResourceContext: document.querySelector("#mapResourceContext"),
```

在 `site/app/map.js` 增加两个函数。第一函数仅当 `state.mapMode` 为 `"resource"` 或 `"resourceSelection"` 且 `state.mapSubject` 非空时返回原始资源键；其余情况返回空字符串。第二函数按该键显示或清空 `els.mapResourceContext`。资源名称继续复用 `mapSubjectLabel()`；版本读取 `data.meta?.victoria3_version || "未知"`；资源键存在于 `buildingIconFileByKey` 时输出 22 像素的装饰性 `<img>`，否则输出带 `--map-resource-context-color` 的圆形 `map-resource-context-swatch`。图标文件名和可见文字分别用 `encodeURIComponent()`、`escapeHtml()` 处理。

核心结构如下：

```js
function renderMapResourceContext() {
  if (!els.mapResourceContext) return;
  const resourceKey = mapResourceContextResourceKey();
  if (!resourceKey) {
    els.mapResourceContext.hidden = true;
    els.mapResourceContext.textContent = "";
    return;
  }
  const fileName = buildingIconFileByKey[resourceKey];
  const icon = fileName
    ? `<img class="map-resource-context-icon" src="assets/buildings/${encodeURIComponent(fileName)}" alt="">`
    : `<span class="map-resource-context-swatch" style="--map-resource-context-color: ${escapeHtml(resourceMapColor(resourceKey))}" aria-hidden="true"></span>`;
  const label = mapSubjectLabel();
  const version = data.meta?.victoria3_version || "未知";
  els.mapResourceContext.hidden = false;
  els.mapResourceContext.innerHTML = `${icon}<span class="map-resource-context-name">${escapeHtml(label)}</span><span class="map-resource-context-version">· ${escapeHtml(version)}</span>`;
}
```

在 `renderMapControls()` 完成 `syncMapModeForView()` 和下拉框赋值后调用该函数；地图模式控件缺失以及 ideology、law 早退前也调用一次，以确保遗留内容隐藏。不要在按钮上添加点击处理，不要改变筛选、重置或下拉框的行为。

- [ ] **Step 4：给上下文栏补充紧凑、可收缩样式。**

在 `site/styles/map.css` 添加 `.map-resource-context` 相关规则。它使用与工具栏相近的深色半透明背景、细边框和圆角，采用 `inline-flex` 垂直居中，名称与图标间距为 6 像素。图片固定为 `22px × 22px`；色点为 14 像素圆形并使用 `var(--map-resource-context-color)`；名称允许截断；版本使用 `white-space: nowrap` 和 `flex: none`，不得单独换行。整体限制为 `max-width: min(250px, calc(100vw - 168px))`，以便窄屏保留版本且工具栏可自然折行。`[hidden]` 必须显式 `display: none`。

- [ ] **Step 5：启动站点并运行浏览器检查。**

在 PowerShell 用隐藏窗口启动临时本地服务，避免占用交互终端：

```powershell
$resourceMapServer = Start-Process -FilePath node -ArgumentList @("scripts/serve_site.mjs", "site", "8876") -WorkingDirectory (Get-Location).Path -WindowStyle Hidden -PassThru
$env:NODE_PATH = "C:\Users\SamuY\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules"
$env:VC_CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
node scripts/check_resource_map_colors_browser.mjs http://127.0.0.1:8876/index.html
Stop-Process -Id $resourceMapServer.Id
```

预期浏览器检查通过：资源上下文栏展示小麦和铁矿各自的图标、名称和版本；画布无农业或矿产资源文字；取消选择后上下文隐藏。

### Task 3：改为农业自然色，并提高资源图陆地不透明度

**文件：**
- 修改：`site/app/map.js:762-807,998-1002`
- 修改：`site/app/runtime.js:58-75`
- 测试：`scripts/check_resource_map_colors.mjs`

- [ ] **Step 1：把农业资源改为逐项低值、高值色。**

删除 `AGRICULTURAL_RESOURCE_NEUTRAL_COLOR`、`AGRICULTURAL_RESOURCE_COLOR`、`AGRICULTURAL_RESOURCE_KEYS` 与由该集合展开的统一颜色项。保留矿产、渔业、林业、橡胶和石油的现有 `RESOURCE_MAP_COLOR_BY_KEY` 终点色，保留 `RESOURCE_MAP_NEUTRAL_COLOR = "#f6d89a"`、`RESOURCE_MAP_DEFAULT_COLOR = "#9b4a2f"` 与金矿场别名。新增以下映射：

```js
const RESOURCE_MAP_GRADIENT_BY_KEY = new Map([
  ["building_wheat_farm", { low: "#f0dea8", high: "#c69b32" }],
  ["building_rye_farm", { low: "#e0ca98", high: "#8d713d" }],
  ["building_rice_farm", { low: "#cce7c7", high: "#4f9b72" }],
  ["building_maize_farm", { low: "#f2dfa4", high: "#d59d27" }],
  ["building_millet_farm", { low: "#e7d2a7", high: "#b88735" }],
  ["building_livestock_ranch", { low: "#dacdb9", high: "#87643e" }],
  ["building_vineyard", { low: "#ddc7df", high: "#7e4b86" }],
  ["building_coffee_plantation", { low: "#ddc8b5", high: "#765039" }],
  ["building_tea_plantation", { low: "#c6e2c5", high: "#3d7e4d" }],
  ["building_tobacco_plantation", { low: "#e7caa2", high: "#a66e37" }],
  ["building_opium_plantation", { low: "#e8c5d6", high: "#a85e83" }],
  ["building_banana_plantation", { low: "#efe9ab", high: "#b7a92d" }],
  ["building_sugar_plantation", { low: "#cae1bf", high: "#72a05e" }],
  ["building_silk_plantation", { low: "#e7d8e3", high: "#b27fa9" }],
  ["building_cotton_plantation", { low: "#deecf1", high: "#8baebb" }],
  ["building_dye_plantation", { low: "#c5d0ec", high: "#4c5ea7" }],
]);
```

新增 `resourceMapGradient(resourceKey)`：先解析别名，再读取上述映射；没有专属项时返回 `{ low: RESOURCE_MAP_NEUTRAL_COLOR, high: resourceMapColor(resolvedKey) }`。让 `resourceMapGradientColor()` 取得这两个端点后继续按现有平方根比例插值。`buildResourceMapFeatures()` 与 `buildSelectedResourceMapFeatures()` 均继续只调用该函数，因此农业和非农业路径保持一致；多资源外部状态使用空资源键，会退回原有黄褐色渐变。

- [ ] **Step 2：只提高资源模式中可见陆地的不透明度。**

在 `site/app/runtime.js` 的地图透明度常量旁增加：

```js
const MAP_RESOURCE_LAND_ALPHA = 232;
```

在 `mapPixelAlpha()` 保留海洋 `MAP_SEA_ALPHA` 与不可见区域 `MAP_MUTED_ALPHA` 的判断，仅把最终返回改为：

```js
return ["resource", "resourceSelection"].includes(state.mapMode)
  ? MAP_RESOURCE_LAND_ALPHA
  : MAP_LAND_ALPHA;
```

这样只影响已选资源的陆地填色，国家、文化、特质、公司和战略区域模式的透明度不变。

- [ ] **Step 3：运行静态检查，得到绿色状态。**

运行：

```powershell
node scripts/check_resource_map_colors.mjs
```

预期输出包含 `resource_map_colors: "ok"` 和当前数据集资源数。若资源数不是 27，先核查当前版本数据是否变化，再更新颜色表及断言，不能通过弱化检查掩盖缺项。

### Task 4：缓存、完整回归、生成站点与工作记录

**文件：**
- 修改：`scripts/check_region_map_interaction.mjs`
- 修改：`docs/worklog/2026-07-31.md`
- 修改：`WORKLOG.md`
- 验证：`Victorian Century Database/`

- [ ] **Step 1：同步已有区域地图检查中的地图脚本缓存版本。**

搜索 `scripts/check_region_map_interaction.mjs` 中旧的 `20260730-resource-map-colors1`，改为 `20260731-resource-map-natural-colors1`。除缓存版本断言外，不修改该脚本的交互契约。

- [ ] **Step 2：运行完整静态与浏览器回归。**

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

使用 Task 2 的临时服务再运行 `check_resource_map_colors_browser.mjs`。浏览器手工检查 `#/region` 的小麦、稻米、葡萄园、咖啡、茶叶、棉花、染料、畜牧场、铁矿与金矿：确认农业颜色按作物分开，低储量区域不再受底图影响呈强烈黄色，铁矿保持蓝灰、金矿保持金色，数值标签与提示框仍正常。缩窄浏览器宽度，确认资源名可以截断，版本仍和图标、名称处于同一上下文栏。

- [ ] **Step 3：重建并核对 Victorian Century 站点。**

运行：

```powershell
node scripts/build_victorian_century_site.mjs --skip-vc-assets
Get-FileHash site\app\map.js -Algorithm SHA256
Get-FileHash "Victorian Century Database\app\map.js" -Algorithm SHA256
```

两个 SHA-256 值必须相同。通过本地服务打开 Victorian Century 入口，选择一个农业资源，确认上下文栏显示对应名称、图标和该站点的资料库版本。对于 Victoria 3 建筑图标表中没有的 `bg_monuments`，静态代码路径应使用圆形色点，页面不得请求损坏图片。生成目录和 `site/vc/` 均由忽略规则管理，不暂存。

- [ ] **Step 4：写入工作记录并选择性暂存。**

在 `docs/worklog/2026-07-31.md` 记录：取消农业水印，16 种农业渐变端点，上下文栏显示条件和图标回退，资源模式的透明度，主站与 Victorian Century 的验证结果。将 `WORKLOG.md` 的当前任务更新为完成状态并链接该详细记录；该根文件受忽略规则管理，不暂存。

由于 `site/app/map.js`、`site/index.html` 以及工作区已有用户改动，使用交互暂存，确保不带入 `site/app/components.js` 的可发现资源总量改动、`scripts/check_discoverable_resource_totals.mjs`、`Victorian`、`screenshots/`、`scripts/__pycache__/` 或其他无关文件：

```powershell
git add scripts/check_resource_map_colors.mjs scripts/check_resource_map_colors_browser.mjs scripts/check_region_map_interaction.mjs site/app/runtime.js site/app/data.js site/styles/map.css docs/worklog/2026-07-31.md
git add -p site/app/map.js
git add -p site/index.html
git add docs/superpowers/plans/2026-07-31-resource-map-natural-colors-and-context-strip.md
git diff --cached --check
git diff --cached --stat
git commit -m "feat: refine resource map colors"
```

提交前再次查看 `git status --short` 和 `git diff --cached`，确认暂存区只包含本计划的资源地图代码、测试、记录和计划文件。
