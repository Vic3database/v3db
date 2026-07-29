# 公司板块默认列表与详情定位图实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 公司列表页隐藏主地图，史实公司详情显示不可交互的定位小地图，通用公司不显示该地图。

**Architecture:** 保留现有主地图数据加载、图层构建和州地区边界绘制。`site/app/map.js` 新增公司地点州地区推导和可指定画布的绘制入口；详情画布复用已生成的公司地图图层，但拥有独立视野变换，因此不会恢复主地图工具栏、拖拽或点选。`site/app/presentation.js` 负责在史实公司详情中插入“位置”小节，样式负责隐藏公司页主地图并限定详情画布。

**Tech Stack:** 原生 JavaScript、Canvas 2D、CSS、Node.js 静态回归检查。

---

## 文件范围

- 新建：`scripts/check_company_detail_location_map.mjs`，验证数据例外、地点推导接口、详情标记和样式约束。
- 修改：`site/app/map.js`，推导史实公司地点州地区、扩展公司图层关联、向详情画布绘制只读小地图。
- 修改：`site/app/presentation.js`，将地点字段放入“位置”小节并插入小地图画布。
- 修改：`site/styles/shell.css`，在公司视图隐藏主地图面板。
- 修改：`site/styles/records.css`，定义详情定位图的尺寸和禁用指针交互。
- 修改：`site/styles.css`、`site/index.html`，更新受改动样式与脚本的缓存版本参数。
- 修改：`scripts/check_ui_ideology_contracts.mjs`，保留公司行选择、详情按钮和完整列表的既有断言，同时移除仅面向可见公司主地图的假设。

### Task 1: 建立公司地点推导的失败检查

**Files:**

- Create: `scripts/check_company_detail_location_map.mjs`

- [ ] **Step 1: 写入检查脚本，要求地点推导函数、两个定向文化本土例外和详情标记存在。**

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readChunkedSiteData } from "./site_data_reader.mjs";
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const root = process.cwd();
const app = readSiteAppSource(root);
const styles = readSiteStyleSource(root);
const data = readChunkedSiteData(root);
const companyByKey = new Map(data.companies.map((company) => [company.key, company]));
const stateRegions = data.stateRegions || [];

const cfr = companyByKey.get("company_cfr");
const tobacco = companyByKey.get("company_ottoman_tobacco_regie");
const genericWine = companyByKey.get("company_argentinian_wine");
assert.equal(cfr?.company_kind, "historical");
assert.equal(tobacco?.company_kind, "historical");
assert.equal(genericWine?.company_kind, "generic");
assert.deepEqual(cfr?.referenced_cultures.map((item) => item.key), ["romanian"]);
assert.deepEqual(tobacco?.referenced_cultures.map((item) => item.key), ["turkish"]);
assert.equal(stateRegions.filter((stateRegion) => stateRegion.homeland_cultures?.some((culture) => culture.key === "romanian")).length, 9);
assert.equal(stateRegions.filter((stateRegion) => stateRegion.homeland_cultures?.some((culture) => culture.key === "turkish")).length, 22);

assert.match(app, /function\s+companyLocationStateRegionKeys\s*\(/, "company location state-key resolver is missing");
assert.match(app, /company_cfr[\s\S]*romanian/, "Romanian railway must use Romanian homelands");
assert.match(app, /company_ottoman_tobacco_regie[\s\S]*turkish/, "Ottoman tobacco company must use Turkish homelands");
assert.match(app, /companyKindKey\(company\)\s*!==\s*"historical"/, "generic and easter-egg companies must not receive a detail location map");
assert.match(app, /referenced_strategic_regions[\s\S]*states/, "company location resolver must expand strategic regions into state regions");
assert.match(app, /referenced_geographic_regions[\s\S]*geographicRegionStateRegions/, "company location resolver must expand geographic regions into state regions");
assert.match(app, /data-company-location-map/, "company detail must render a dedicated map canvas marker");
assert.match(styles, /body\[data-view="company"\]\s+\.map-panel/, "company list view must hide the main map panel");
assert.match(styles, /\.company-location-map/, "company detail map needs dedicated styles");

console.log(JSON.stringify({ company_detail_location_map: "ok", romanian_homelands: 9, turkish_homelands: 22 }));
```

- [ ] **Step 2: 运行检查，确认失败原因是尚未实现的地点推导和详情画布。**

Run: `node scripts/check_company_detail_location_map.mjs`

Expected: 以 `company location state-key resolver is missing` 失败，退出码为 `1`。

### Task 2: 推导史实公司地点并复用地图图层

**Files:**

- Modify: `site/app/map.js:112-144`
- Modify: `site/app/map.js:291-337`
- Modify: `site/app/map.js:897-1019`
- Test: `scripts/check_company_detail_location_map.mjs`

- [ ] **Step 1: 在 `site/app/map.js` 中添加公司地点规则和州地区推导函数。**

在 `geographicRegionStateRegions` 后加入下列函数。例外表只包含用户确认的两家史实公司；不要把任意 `referenced_cultures` 自动展开为文化本土。

```js
const companyLocationHomelandCultureByKey = new Map([
  ["company_cfr", "romanian"],
  ["company_ottoman_tobacco_regie", "turkish"],
]);

function companyLocationStateRegionKeys(company) {
  if (companyKindKey(company) !== "historical") return [];
  const strategicStateKeys = (company.referenced_strategic_regions || [])
    .flatMap((regionRef) => (byStrategicRegion.get(regionRef.key)?.states || []).map((stateRef) => stateRef.key));
  const geographicStateKeys = (company.referenced_geographic_regions || [])
    .flatMap((regionRef) => geographicRegionStateRegions(byGeographicRegion.get(regionRef.key) || regionRef).map((stateRegion) => stateRegion.key));
  const homelandCultureKey = companyLocationHomelandCultureByKey.get(company.key);
  const homelandStateKeys = homelandCultureKey
    ? stateRegions
      .filter((stateRegion) => (stateRegion.homeland_cultures || []).some((culture) => culture.key === homelandCultureKey))
      .map((stateRegion) => stateRegion.key)
    : [];
  return unique([
    ...(company.preferred_headquarters || []).map((stateRegion) => stateRegion.key),
    ...(company.referenced_state_regions || []).map((stateRegion) => stateRegion.key),
    ...strategicStateKeys,
    ...geographicStateKeys,
    ...homelandStateKeys,
  ]).filter((stateKey) => {
    const stateRegion = byStateRegion.get(stateKey);
    return stateRegion && !isSeaStateRegion(stateRegion);
  });
}

function companyDetailLocationMapEnabled(company) {
  return companyKindKey(company) === "historical";
}

function companyLocationSummary(company, stateKeys) {
  const homelandCultureKey = companyLocationHomelandCultureByKey.get(company.key);
  if (homelandCultureKey === "romanian") return `罗马尼亚文化本土，共 ${stateKeys.length} 个州地区`;
  if (homelandCultureKey === "turkish") return `土耳其文化本土，共 ${stateKeys.length} 个州地区`;
  return `总部倾向及关联地区，共 ${stateKeys.length} 个州地区`;
}
```

- [ ] **Step 2: 让公司图层按完整地点集合建立关联。**

将 `buildCompanyStateAssociations` 中的 `referenced` 和 `stateKeys` 计算替换为下列代码，使战略区域、地理区域和两家定向例外都出现在详情图层中；总部仍保留为总部类别，其余地点属于关联地点。

```js
const headquarters = new Set((company.preferred_headquarters || []).map((stateRegion) => stateRegion.key).filter(Boolean));
const stateKeys = companyLocationStateRegionKeys(company);
const referenced = new Set(stateKeys.filter((stateKey) => !headquarters.has(stateKey)));
```

- [ ] **Step 3: 将州地区聚焦计算抽为可复用的变换函数。**

把 `focusStateRegionsOnMap` 中由 `centers` 到 `normalizeMapTransformX()` 之前的计算提取为 `mapTransformForStateRegions(stateKeys, viewport, options)`。该函数返回 `{ scale, x, y }` 或在无可用中心、零尺寸视口时返回 `null`；`focusStateRegionsOnMap` 保持原有 API，只需把返回值赋给 `mapRuntime.transform` 后调用 `hideMapTooltip()` 和 `paintMapCanvas()`。

```js
function mapTransformForStateRegions(stateKeys, viewport, options = {}) {
  if (!mapRuntime.ready || !mapRuntime.stateCenters) return null;
  const centers = (stateKeys || []).map((key) => mapRuntime.stateCenters.get(key)).filter(Boolean);
  const rect = viewport?.getBoundingClientRect();
  if (!centers.length || !rect?.width || !rect?.height) return null;
  const padding = options.padding ?? 70;
  const minX = Math.min(...centers.map((point) => point.x));
  const maxX = Math.max(...centers.map((point) => point.x));
  const minY = Math.min(...centers.map((point) => point.y));
  const maxY = Math.max(...centers.map((point) => point.y));
  const targetScale = Math.min(rect.width / Math.max(80, maxX - minX + padding * 2), rect.height / Math.max(80, maxY - minY + padding * 2));
  const worldFitScale = Math.min(rect.width / mapRuntime.width, rect.height / mapRuntime.height);
  const maxScale = options.maxWorldScale ? worldFitScale * options.maxWorldScale : options.maxScale ?? 2.8;
  const transform = {
    scale: clampNumber(targetScale, options.minScale ?? worldFitScale, maxScale),
    x: 0,
    y: 0,
  };
  transform.x = rect.width / 2 - ((minX + maxX) / 2) * transform.scale;
  transform.y = rect.height / 2 - ((minY + maxY) / 2) * transform.scale;
  normalizeMapTransformX(transform);
  return transform;
}
```

将 `normalizeMapTransformX` 改为接收可选 `transform = mapRuntime.transform` 参数，并在函数内部只修改该参数。

- [ ] **Step 4: 将现有绘制函数扩展为可绘制到指定详情画布。**

保留 `paintMapCanvas()` 作为主地图入口，并新增 `paintMapCanvasTarget(canvas, viewport, transform, drawLabels = false)`。主地图调用 `paintMapCanvasTarget(els.mapCanvas, els.mapViewport, mapRuntime.transform, true)`；详情图使用 `false`，因此不会渲染大地图的数字标签。`visibleMapCopyRange` 和 `drawMapLabels` 都接收 `transform` 参数，默认仍使用 `mapRuntime.transform`。

```js
function paintMapCanvas() {
  if (!els.mapCanvas || !els.mapViewport) return;
  paintMapCanvasTarget(els.mapCanvas, els.mapViewport, mapRuntime.transform, true);
}

function paintMapCanvasTarget(canvas, viewport, transform, drawLabels = false) {
  if (!mapRuntime.layerCanvas || !canvas || !viewport || !transform) return;
  const rect = viewport.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1) * 1.4);
  const width = Math.max(1, Math.floor(rect.width * ratio));
  const height = Math.max(1, Math.floor(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#d7c2a4";
  context.fillRect(0, 0, width, height);
  context.setTransform(transform.scale * ratio, 0, 0, transform.scale * ratio, transform.x * ratio, transform.y * ratio);
  context.imageSmoothingEnabled = false;
  const copyRange = visibleMapCopyRange(rect.width, transform);
  for (let copy = copyRange.start; copy <= copyRange.end; copy += 1) {
    if (mapRuntime.paperMapImage) context.drawImage(mapRuntime.paperMapImage, copy * mapRuntime.width, 0, mapRuntime.width, mapRuntime.height);
    context.drawImage(mapRuntime.layerCanvas, copy * mapRuntime.width, 0);
  }
  if (drawLabels) drawMapLabels(context, copyRange, transform);
}
```

- [ ] **Step 5: 添加详情地图重绘函数，并处理延迟地图加载和窗口尺寸变化。**

在 `map.js` 增加以下函数。它只能查询 `data-company-location-map`，不会绑定任何指针、滚轮、提示框或工具栏事件。

```js
function renderCompanyDetailLocationMap(company = byCompany.get(state.selectedCompany)) {
  if (state.view !== "company" || !isDetailPageRoute() || !companyDetailLocationMapEnabled(company)) return;
  const canvas = els.detail?.querySelector("[data-company-location-map]");
  const viewport = canvas?.closest(".company-location-map");
  const stateKeys = companyLocationStateRegionKeys(company);
  if (!canvas || !viewport || !stateKeys.length) return;
  if (!mapRuntime.ready || !mapRuntime.layerCanvas) {
    ensureMapLoaded();
    return;
  }
  const transform = mapTransformForStateRegions(stateKeys, viewport, { maxWorldScale: 2.2, padding: 180 });
  if (transform) paintMapCanvasTarget(canvas, viewport, transform, false);
}
```

在 `ensureMapLoaded` 的异步加载完成分支中，在 `renderMap(...)` 和 `focusCurrentMapSelection()` 后追加 `renderCompanyDetailLocationMap();`。在现有的 `window.addEventListener("resize", ...)` 回调末尾追加同一调用。这样初次加载和右栏宽度改变时均能重新绘制详情地图。

- [ ] **Step 6: 运行地点检查，确认其通过。**

Run: `node scripts/check_company_detail_location_map.mjs`

Expected: 输出 `company_detail_location_map: "ok"`、`romanian_homelands: 9`、`turkish_homelands: 22`，退出码为 `0`。

### Task 3: 接入详情内容并隐藏公司主地图

**Files:**

- Modify: `site/app/presentation.js:578-626`
- Modify: `site/styles/shell.css:180-185`
- Modify: `site/styles/records.css:1171-1215`
- Modify: `site/styles.css:1-8`
- Modify: `site/index.html:7,277-280`
- Modify: `scripts/check_company_detail_location_map.mjs`
- Modify: `scripts/check_ui_ideology_contracts.mjs:129-146`

- [ ] **Step 1: 扩展检查脚本，先要求位置小节不会用于通用或彩蛋公司，并要求小地图完全只读。**

在 `scripts/check_company_detail_location_map.mjs` 的现有样式断言后加入：

```js
assert.match(app, /function\s+companyDetailLocationHtml\s*\(/, "company detail location section renderer is missing");
assert.match(app, /companyDetailLocationMapEnabled\(company\)/, "company detail must gate the location section by company kind");
assert.match(app, /暂无可定位地点/, "historical companies without usable locations need an explicit message");
assert.match(app, /queueMicrotask\(\(\)\s*=>\s*renderCompanyDetailLocationMap\(company\)\)/, "company detail must schedule its map after inserting the canvas");
assert.match(styles, /\.company-location-map\s+canvas\s*{[\s\S]*pointer-events:\s*none[\s\S]*cursor:\s*default/, "detail map canvas must not accept pointer interaction");
assert.doesNotMatch(app.match(/function companyDetailLocationHtml[\s\S]*?\n}/)?.[0] || "", /map-toolbar|mapModeSelect|mapSubjectSelect|mapFitWidthButton/, "detail location section must not duplicate main-map controls");
```

- [ ] **Step 2: 运行检查，确认失败原因是详情位置小节尚未实现。**

Run: `node scripts/check_company_detail_location_map.mjs`

Expected: 以 `company detail location section renderer is missing` 失败，退出码为 `1`。

- [ ] **Step 3: 在 `site/app/presentation.js` 中渲染“位置”小节。**

在 `renderCompanyDetail` 前加入下列函数。它只向史实公司输出小节；没有地点州地区时保留明确的文字，而不输出画布。

```js
function companyDetailLocationHtml(company) {
  if (!companyDetailLocationMapEnabled(company)) return "";
  const stateKeys = companyLocationStateRegionKeys(company);
  return `
    <section class="company-location-section" aria-label="公司位置">
      <h3>位置</h3>
      ${stateKeys.length ? `
        <div class="company-location-map">
          <canvas data-company-location-map aria-label="${escapeHtml(company.name_zh || company.key)}的关联地点地图"></canvas>
        </div>
        <p class="minor company-location-summary">${escapeHtml(companyLocationSummary(company, stateKeys))}</p>
      ` : `<p class="empty">暂无可定位地点。</p>`}
      <dl class="field-grid company-location-fields">
        ${field("总部倾向", stateRegionLinks(company.preferred_headquarters))}
        ${field("相关战略区域", strategicRegionLinks(company.referenced_strategic_regions))}
        ${field("相关地理区域", geographicRegionLinks(company.referenced_geographic_regions))}
        ${field("相关州地区", stateRegionLinks(company.referenced_state_regions))}
      </dl>
    </section>
  `;
}
```

将 `renderCompanyDetail` 的“基础”字段改为只保留类型、控股类别、资料片、名贵商品状态、相关文化、相关国家、所需科技和 AI 倾向科技；把总部倾向、三个地区字段移除。紧接在基础 `</dl>` 后插入 `${companyDetailLocationHtml(company)}`。在 `els.detail.innerHTML = ...` 结束后追加：

```js
queueMicrotask(() => renderCompanyDetailLocationMap(company));
```

- [ ] **Step 4: 在样式中隐藏公司主地图并限定详情画布。**

在 `site/styles/shell.css` 中现有意识形态和法律地图隐藏规则之后加入：

```css
body[data-view="company"] .map-panel,
body[data-view="company"] .map-toolbar {
  display: none;
}
```

在 `site/styles/records.css` 的详情规则之后加入：

```css
.company-location-section {
  margin: 18px 0;
}

.company-location-section > h3 {
  margin-bottom: 10px;
}

.company-location-map {
  height: clamp(156px, 22vh, 236px);
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #d7c2a4;
}

.company-location-map canvas {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
  cursor: default;
  image-rendering: pixelated;
}

.company-location-summary {
  margin: 8px 0 0;
}

.company-location-fields {
  margin-top: 10px;
}
```

- [ ] **Step 5: 更新静态资源缓存版本。**

将 `site/styles.css` 中 `records.css` 与 `shell.css` 的导入参数改为 `v=20260718-company-location1`。将 `site/index.html` 的 `styles.css`、`app/presentation.js` 与 `app/map.js` 的查询参数都改为 `v=20260718-company-location1`。其余脚本保持原有参数。

- [ ] **Step 6: 更新既有公司交互断言。**

在 `scripts/check_ui_ideology_contracts.mjs` 中保留 `renderCompanyList` 不限 220 项、`data-company-detail`、`openCompanyDetail`、`selectCompanyCard` 和 `selectionHashForCard` 的现有断言。将“选择公司卡片应聚焦可见地图”的断言替换为下列内容，避免把隐藏的主地图当成公司板块的交互前提：

```js
assert(/function\s+companyDetailLocationMapEnabled\s*\(/.test(appSource), "company details should classify whether a location map is allowed");
assert(/function\s+companyLocationStateRegionKeys\s*\(/.test(appSource), "company details should derive location states from company data");
assert(/data-company-location-map/.test(appSource), "historical company details should expose a dedicated location canvas");
```

- [ ] **Step 7: 运行新旧静态检查，确认通过。**

Run: `node scripts/check_company_detail_location_map.mjs; node scripts/check_ui_ideology_contracts.mjs; node scripts/check_country_map_selection.mjs; node scripts/check_frontend_file_split.mjs`

Expected: 四个命令都以退出码 `0` 结束；新脚本输出 `company_detail_location_map: "ok"`。

### Task 4: 完整验证与提交

**Files:**

- Modify: `site/app/map.js`
- Modify: `site/app/presentation.js`
- Modify: `site/styles/shell.css`
- Modify: `site/styles/records.css`
- Modify: `site/styles.css`
- Modify: `site/index.html`
- Modify: `scripts/check_company_detail_location_map.mjs`
- Modify: `scripts/check_ui_ideology_contracts.mjs`

- [ ] **Step 1: 运行语法、数据和差异检查。**

Run: `node --check site/app/map.js; node --check site/app/presentation.js; node scripts/check_company_detail_location_map.mjs; node scripts/check_ui_ideology_contracts.mjs; node scripts/check_country_map_selection.mjs; node scripts/check_data_chunking.mjs; git diff --check`

Expected: 所有 Node 命令退出码为 `0`；`git diff --check` 无输出。

- [ ] **Step 2: 在本地站点核对四条路由的实际页面。**

Run:

```powershell
$server = Start-Process -FilePath python -ArgumentList @('-m', 'http.server', '8876', '--directory', 'site') -WorkingDirectory 'D:\Bot\Vic3\Victoria3_DB' -WindowStyle Hidden -PassThru
```

在浏览器依次打开 `http://127.0.0.1:8876/index.html#/company`、`#/company/company_a_markwald_and_company`、`#/company/company_argentinian_wine`、`#/company/company_cfr` 与 `#/company/company_ottoman_tobacco_regie`。检查条件如下：

```js
({
  view: document.body.dataset.view,
  mainMapVisible: getComputedStyle(document.querySelector('#mapPanel')).display !== 'none',
  companyRows: document.querySelectorAll('[data-company]').length,
  detailLocationSections: document.querySelectorAll('.company-location-section').length,
  detailMapCanvases: document.querySelectorAll('[data-company-location-map]').length,
  detailMapPointerEvents: document.querySelector('[data-company-location-map]') ? getComputedStyle(document.querySelector('[data-company-location-map]')).pointerEvents : null,
  detailText: document.querySelector('#detail')?.innerText || ''
})
```

预期：列表路由 `mainMapVisible` 为 `false`、`companyRows` 为 `221`、详情小节与画布均为 `0`；普通史实公司有一个位置小节和一个画布，画布的 `pointerEvents` 为 `none`；通用公司位置小节和画布均为 `0`；两家例外史实公司各有一个画布，文字分别包含“罗马尼亚文化本土，共 9 个州地区”和“土耳其文化本土，共 22 个州地区”。完成后执行 `Stop-Process -Id $server.Id`。

- [ ] **Step 3: 检查变更范围并提交。**

Run:

```powershell
git status --short
git diff -- site/app/map.js site/app/presentation.js site/styles/shell.css site/styles/records.css site/styles.css site/index.html scripts/check_company_detail_location_map.mjs scripts/check_ui_ideology_contracts.mjs
git add -- site/app/map.js site/app/presentation.js site/styles/shell.css site/styles/records.css site/styles.css site/index.html scripts/check_company_detail_location_map.mjs scripts/check_ui_ideology_contracts.mjs
git commit -m "feat: move company map into historical details"
```

Expected: 暂存内容仅包含上述八个文件，提交信息为 `feat: move company map into historical details`。
