# 自给建筑地图实施计划

> **供执行代理使用：** 必须使用 `superpowers:executing-plans`，按任务逐项实施。

**目标：** 在地区板块的资源筛选栏加入“自给建筑”入口，以五种固定颜色显示五类自给建筑，并在地区中心显示可耕土地上限。

**架构：** 新筛选项 `subsistence_buildings` 驱动专用 `subsistenceBuildings` 地图模式，沿用资源筛选的互斥选择、地图缓存、平移、缩放、单击与双击。地图特征只读取 `subsistence_building` 和 `arable_land`；数字复用资源地图标签的描边、缩放与横向环绕绘制，图例作为工具栏下的独立元素。

**技术栈：** 原生 JavaScript、Canvas 2D、Node.js 静态检查、Playwright。

---

## 文件结构

- `site/index.html`：图例容器与缓存版本。
- `site/app/runtime.js`：专用筛选项和图例元素引用。
- `site/app/components.js`：无图标筛选按钮与本地化名称。
- `site/app/ui.js`：资源筛选入口互斥选择。
- `site/app/map.js`：模式、固定颜色、特征、图例、数字和提示框。
- `site/styles/map.css`：图例布局。
- `site/locales/ui.zh-Hans.js`、`site/locales/ui.en.js`：中英文文本。
- `scripts/check_subsistence_building_map.mjs`、`scripts/check_subsistence_building_map_browser.mjs`：静态与浏览器回归。

### Task 1：入口与数据契约

**文件：** `site/app/runtime.js`、`site/app/components.js`、`site/locales/ui.zh-Hans.js`、`site/locales/ui.en.js`、`scripts/check_subsistence_building_map.mjs`

- [ ] 写入失败静态检查，解析 `site/versions/1.13.9/data-regions.js`，断言唯一值恰为 `building_subsistence_farm`、`building_subsistence_rice_farm`、`building_subsistence_pasture`、`building_subsistence_orchard`、`building_subsistence_fishing_village`；断言筛选定义为 `{ key: "subsistence_buildings", labelKey: "filter.subsistenceBuildings", mapMode: "subsistenceBuildings" }`。
- [ ] 运行 `node scripts/check_subsistence_building_map.mjs`，确认因筛选项缺失失败。
- [ ] 在农业组后增加只含该筛选项的“自给建筑”组；令 `resourceFilterLabel()` 优先返回 `t(filter.labelKey)`，令无图标的 `resourceOptionToken()` 直接显示标签文本。添加中英文入口、五种自给建筑和“可耕土地”文本。
- [ ] 重新运行静态检查，预期输出五种实际键；提交：`git add site/app/runtime.js site/app/components.js site/locales/ui.zh-Hans.js site/locales/ui.en.js scripts/check_subsistence_building_map.mjs; git commit -m "feat: add subsistence building map entry"`。

### Task 2：固定颜色与地图模式

**文件：** `site/app/map.js`、`scripts/check_subsistence_building_map.mjs`

- [ ] 将检查扩展为失败断言：五项 `SUBSISTENCE_BUILDING_COLORS` 映射依次为农场 `#c8893f`、水稻农场 `#4c9f70`、牧场 `#8b6f47`、果园 `#b5688b`、渔村 `#4b87b6`；存在 `buildSubsistenceBuildingMapFeatures()`；海域使用 `MAP_SEA_COLOR`，缺失值使用 `SUBSISTENCE_BUILDING_EMPTY_COLOR`。
- [ ] 运行 `node scripts/check_subsistence_building_map.mjs`，确认因缺少函数失败。
- [ ] 在 `syncMapModeForView()` 的资源筛选分支中读取唯一筛选项的 `mapMode`，命中时设置 `state.mapMode = "subsistenceBuildings"` 并清空 `mapSubject`；在 `buildMapFeatures()` 分派该模式。特征函数对每个地区写入固定色、`subsistenceBuildingKey`、以及仅针对陆地有限数值的 `label: formatMapLabelValue(arableLand)`，保留数值 `0`。
- [ ] 运行静态检查并提交：`git add site/app/map.js scripts/check_subsistence_building_map.mjs; git commit -m "feat: color map by subsistence building"`。

### Task 3：图例、数字与提示框

**文件：** `site/index.html`、`site/app/runtime.js`、`site/app/map.js`、`site/styles/map.css`、`scripts/check_subsistence_building_map.mjs`

- [ ] 写入失败断言：存在 `<div id="subsistenceBuildingMapLegend" class="subsistence-building-map-legend" hidden></div>`、运行时元素引用、`renderSubsistenceBuildingMapLegend()`、`drawMapLabels()` 的 `subsistenceBuildings` 分支和提示框专用分支。
- [ ] 运行静态检查，确认图例缺失。
- [ ] 在工具栏后加入图例容器；`renderMapControls()` 调用 `renderSubsistenceBuildingMapLegend()`，该函数只在专用模式显示五项固定顺序的颜色方块和本地化名称。扩展 `drawMapLabels()` 支持该模式。`mapTooltipRowsForView()` 在默认地区分支前列出自给建筑的本地化建筑名与可耕土地上限。图例 CSS 使用可换行的 14 像素方块，并确保窄屏不越界。
- [ ] 运行静态检查并提交：`git add site/index.html site/app/runtime.js site/app/map.js site/styles/map.css scripts/check_subsistence_building_map.mjs; git commit -m "feat: label arable land on subsistence map"`。

### Task 4：浏览器回归

**文件：** `scripts/check_subsistence_building_map_browser.mjs`、`scripts/check_subsistence_building_map.mjs`，必要时最小修改 `site/app/map.js`、`site/app/ui.js`、`site/styles/map.css`

- [ ] 新建失败的 Playwright 检查，启动方式复用 `check_resource_map_colors_browser.mjs`。在 `#/region` 点击 `[data-resource-filter="subsistence_buildings"]`，断言模式、按下状态、五项图例、五种特征颜色、陆地标签、海域无标签；悬浮一个自给水稻农场地区，断言提示框同时含建筑名与可耕土地数。验证单击选中、双击详情路由、缩放拖动后标签与图例仍正常，再次点击后恢复战略区域模式。对 Victorian Century 重复入口、图例和标签检查，并以 `390×844` 断言 `scrollWidth === innerWidth`。
- [ ] 运行 `node scripts/check_subsistence_building_map_browser.mjs http://127.0.0.1:8876/index.html`，确认初始失败。
- [ ] 仅处理检查实际报告的缺口；重跑静态与浏览器检查直至通过；提交：`git add scripts/check_subsistence_building_map.mjs scripts/check_subsistence_building_map_browser.mjs site/app/map.js site/app/ui.js site/styles/map.css; git commit -m "test: cover subsistence building map"`。

### Task 5：缓存与最终回归

**文件：** `site/index.html`、`scripts/check_subsistence_building_map.mjs`

- [ ] 将 `styles.css`、`app/runtime.js`、`app/components.js`、`app/ui.js`、`app/map.js` 查询版本统一改为 `20260805-subsistence-map1`，静态检查同时断言该版本。
- [ ] 执行：

```powershell
node --check site/app/runtime.js
node --check site/app/components.js
node --check site/app/ui.js
node --check site/app/map.js
node scripts/check_subsistence_building_map.mjs
node scripts/check_resource_map_colors.mjs
node scripts/check_region_map_interaction.mjs
node scripts/check_subsistence_building_map_browser.mjs http://127.0.0.1:8876/index.html
git diff --check
```

- [ ] 检查范围后提交最终改动：`git status --short; git diff --stat; git add site/index.html site/app/runtime.js site/app/components.js site/app/ui.js site/app/map.js site/styles/map.css site/locales/ui.zh-Hans.js site/locales/ui.en.js scripts/check_subsistence_building_map.mjs scripts/check_subsistence_building_map_browser.mjs; git commit -m "feat: add subsistence building map view"`。

## 计划自检

五种实际键、固定颜色、合成视图、图例、可耕土地数字、提示框、缺失值、海域、主站、Victorian Century、窄屏、平移、缩放、单击和双击分别由 Task 1 至 Task 5 覆盖。计划不改数据提取、建筑素材、资源渐变、地区列表、路由格式或其他地图模式。
