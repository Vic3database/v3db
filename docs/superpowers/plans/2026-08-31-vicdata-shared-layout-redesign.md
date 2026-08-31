# Vicdata Shared Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留现有配色和资料字段的前提下，统一 Vicdata 地图板块与纯内容板块的页面壳层、卡片状态、详情交互和窄屏地图全屏状态。

**Architecture:** 继续使用现有静态单页应用、哈希路由和分拆后的 `site/app`、`site/styles` 文件。先在共享状态和壳层样式中建立地图模式、内容模式、选中对象、详情打开和地图全屏状态，再按国家、其他地图板块、纯内容板块的顺序迁移现有渲染函数。利益集团与宗教保留现有专用布局；Victorian Century 通过现有构建脚本从主站共享前端同步，不单独维护第三套实现。

**Tech Stack:** 原生 JavaScript、CSS、静态 HTML、Node.js 合同脚本、Chrome DevTools Protocol 浏览器检查。

**Spec:** `docs/superpowers/specs/2026-08-31-vicdata-shared-layout-redesign.md`

## Global Constraints

- 保留当前深蓝、灰黑、暗金和米色背景的配色体系。
- 页面仍保持静态单页应用和现有哈希路由，不引入前端框架。
- 不改数据抽取流程，不改数据字段，不制作新图标。
- 国家、文化、地域、公司属于地图模式；意识形态、法律、科技、事件、日志、决议属于内容模式。
- 利益集团和宗教保留当前成熟的整体布局、卡片组织方式和详情行为。
- 地图模式卡片主体点击只选择条目；右上角“进入”按钮才打开详情。
- 内容模式不显示“进入”按钮，点击卡片主体直接打开详情。
- 窄屏地图模式使用“全屏”进入地图专用视图，使用“收起”返回列表。
- `site/` 是主站目录，`Victorian Century Database/` 是 Victorian Century 源目录，`site/vc/` 是生成的发布副本。
- 保留工作区已有未提交文件，不覆盖与本计划无关的修改。

---

### Task 1: 建立共享页面状态与布局合同

**Files:**
- Modify: `site/app/runtime.js` — 增加地图模式、内容模式和地图全屏所需的状态字段。
- Modify: `site/app/ui.js` — 统一页面模式判断、详情打开状态、返回状态和哈希参数解析。
- Modify: `site/index.html` — 增加共享页面模式属性、地图全屏控制和详情状态所需的语义标记。
- Modify: `site/styles/foundation.css` — 增加共享间距、面板宽度、卡片状态和详情宽度变量。
- Modify: `site/styles/shell.css` — 建立桌面端地图模式与内容模式的通用三栏壳层。
- Modify: `site/styles/filters.css` — 让筛选栏只由当前页面模式控制显示。
- Create: `scripts/check_shared_layout_contract.mjs` — 检查页面模式、共享变量、按钮名称和成熟板块排除规则。

**Interfaces:**
- Produces `isMapView(view)`, `isContentView(view)`, `mapFullscreenRequested()`, `openDetailRoute(view, key)` 和 `returnToBoardRoute(view)`，供后续板块渲染函数使用。
- `state.mapFullscreen` 只表示窄屏地图专用视图，不表示条目详情；`state.detailKind` 继续表示详情类型。

- [ ] **Step 1: Write the failing contract**

在 `scripts/check_shared_layout_contract.mjs` 中读取 `site/index.html`、`site/app/runtime.js`、`site/app/ui.js`、`site/styles/foundation.css` 和 `site/styles/shell.css`，加入以下断言：页面模式包含 `map` 与 `content`；状态包含 `mapFullscreen`；页面包含 `data-map-fullscreen`、`data-map-collapse`；共享样式包含面板间距、详情宽度和普通/悬停/选中状态变量；利益集团与宗教仍有专用样式选择器；页面不把 `site/vc` 当作源码入口。

- [ ] **Step 2: Run the contract and verify it fails**

运行：`node scripts/check_shared_layout_contract.mjs`

预期：失败，至少指出当前缺少地图全屏状态或共享页面模式合同。

- [ ] **Step 3: Add the shared state and shell markers**

在 `runtime.js` 为 `state` 增加 `mapFullscreen: false` 和 `mapFullscreenReturn: null`。在 `ui.js` 增加：

```js
function isMapView(view) {
  return ["country", "culture", "region", "company"].includes(view);
}

function isContentView(view) {
  return ["ideology", "law", "technology", "event", "journal", "decision"].includes(view);
}

function mapFullscreenRequested() {
  return new URLSearchParams(location.hash.split("?")[1] || "").get("map") === "fullscreen";
}
```

让 `applyHash()` 在地图板块路由中读取 `map=fullscreen`，只在 `isMapView(state.view)` 成立且视口属于窄屏时设置 `state.mapFullscreen = true`。`render()` 将 `data-page-mode`、`data-detail-open` 和 `data-map-fullscreen` 写入 `body`。在 `index.html` 的地图工具区域增加带 `data-map-fullscreen` 的“全屏”按钮和带 `data-map-collapse` 的“收起”按钮，初始均由 `hidden` 控制。

- [ ] **Step 4: Add the shared CSS rules**

在 `foundation.css` 定义 `--layout-gap`、`--filter-width`、`--detail-width`、`--card-gap`、`--card-radius`、`--state-border` 和 `--state-selected`。在 `shell.css` 统一桌面三栏网格，详情未打开时让中部跨越详情栏位置，详情打开时恢复三栏；为 `.layout`、`.filters`、`.results`、`.detail` 增加 `min-width: 0`，避免长字段撑破中部区域。为统一卡片提供普通、悬停、选中和详情打开状态选择器，但不覆盖 `[data-view="interest-group"]` 与 `[data-view="religion"]` 的专用规则。

- [ ] **Step 5: Run the contract and syntax checks**

运行：`node scripts/check_shared_layout_contract.mjs; node --check site/app/runtime.js; node --check site/app/ui.js; git diff --check`

预期：合同、语法和空白检查全部通过。

- [ ] **Step 6: Commit the shared shell**

```bash
git add site/app/runtime.js site/app/ui.js site/index.html site/styles/foundation.css site/styles/shell.css site/styles/filters.css scripts/check_shared_layout_contract.mjs
git commit -m "feat: add shared Vicdata layout state"
```

### Task 2: 迁移国家地图板块作为交互样板

**Files:**
- Modify: `site/app/boards.js` — 调整国家列表卡片的选择与进入事件。
- Modify: `site/app/components.js` — 补充国家卡片的选中、进入按钮和详情状态标记。
- Modify: `site/app/map.js` — 统一国家地图点击后的选中状态、焦点和重绘行为。
- Modify: `site/styles/records.css` — 统一国家卡片间距、边框、悬停和选中样式。
- Modify: `site/styles/map.css` — 统一地图焦点、选中区域和窄屏地图工具样式。
- Create: `scripts/check_country_shared_layout_browser.mjs` — 验证国家板块桌面和窄屏交互。

**Interfaces:**
- Consumes `isMapView()`、`openDetailRoute()` 和 `returnToBoardRoute()`。
- Produces card selectors `[data-country-tag]`, `[data-map-focus-tag]` 和 `[data-map-enter-tag]`，后续地图板块沿用同一交互合同。

- [ ] **Step 1: Write the failing browser contract**

浏览器检查打开 `#/country`，点击国家卡片主体，断言 `state.selectedTag` 对应卡片具有选中属性、地图焦点发生变化且 `body.detail-page` 仍为 `false`；点击该卡片右上角的 `[data-map-enter-tag]`，断言哈希进入 `#/country/<TAG>`、右侧详情可见；点击返回，断言仍在 `#/country` 且筛选条件不变。窄屏检查国家卡片包含“全屏”按钮，进入详情后列表隐藏并显示返回按钮。

- [ ] **Step 2: Run it and verify it fails**

运行：`node scripts/check_country_shared_layout_browser.mjs`

预期：失败，因为当前国家卡片主体点击和右栏详情仍使用旧的统一点击逻辑，且没有新的交互选择器。

- [ ] **Step 3: Split country card selection from detail entry**

将国家卡片主体保留为选择动作，写入 `state.selectedTag`、地图焦点状态并调用 `render()`；在卡片右上角增加独立按钮，按钮处理器调用 `openDetailRoute("country", tag)`，并使用 `event.stopPropagation()` 防止触发主体选择。详情路由解析继续设置 `state.selectedTag`，但详情打开状态由 `detailRouteKey()` 驱动。

- [ ] **Step 4: Align country map and card states**

让地图点击调用与卡片主体相同的国家选择函数，列表卡片用 `aria-pressed` 或统一的选中数据属性表示状态，地图绘制使用同一 `state.selectedTag` 生成焦点样式。详情打开时保留该状态，返回列表时不清除筛选、排序、列表滚动和地图焦点。

- [ ] **Step 5: Run browser and existing country checks**

运行：`node scripts/check_country_shared_layout_browser.mjs; node scripts/check_country_map_list_focus_browser.mjs; node scripts/check_country_incorporation_browser.mjs`

预期：国家主体选择不打开详情，进入按钮打开详情，地图与列表保持同步，既有国家地图和整合功能检查通过。

- [ ] **Step 6: Commit the country sample**

```bash
git add site/app/boards.js site/app/components.js site/app/map.js site/styles/records.css site/styles/map.css scripts/check_country_shared_layout_browser.mjs
git commit -m "feat: align country map card interactions"
```

### Task 3: 扩展地图模式到文化、地域和公司

**Files:**
- Modify: `site/app/boards.js` — 统一文化、地域、公司列表卡片的选择与详情入口。
- Modify: `site/app/economy.js` — 统一公司相关卡片的主体选择、进入按钮和详情状态。
- Modify: `site/app/map.js` — 让四类地图板块共享地图焦点和视口保存逻辑。
- Modify: `site/styles/records.css` — 应用地图模式卡片状态和详情打开布局。
- Modify: `site/styles/economy.css` — 移除公司板块与共享详情定位冲突的规则，只保留公司字段排版。
- Modify: `site/styles/home.css` — 保持利益集团、宗教和首页专用布局不受地图模式规则覆盖。
- Modify: `scripts/check_shared_map_boards.mjs` — 增加静态板块交互合同。
- Create: `scripts/check_shared_map_boards_browser.mjs` — 覆盖文化、地域、公司三类地图板块。

**Interfaces:**
- Consumes国家样板的 `[data-map-focus-*]` 与 `[data-map-enter-*]` 交互合同。
- Produces四类地图板块一致的主体选择、地图焦点、进入详情和返回行为。

- [ ] **Step 1: Write the failing static and browser checks**

静态检查逐一确认文化、地域和公司渲染函数包含主体选择处理、独立进入按钮和详情路由；确认利益集团与宗教渲染函数不增加地图全屏按钮。浏览器检查分别打开 `#/culture`、`#/region`、`#/company`，选择首个有效卡片，确认详情未打开；点击进入按钮，确认右栏详情打开且列表卡片仍为选中状态。

- [ ] **Step 2: Run the checks and verify the expected failures**

运行：`node scripts/check_shared_map_boards.mjs; node scripts/check_shared_map_boards_browser.mjs`

预期：至少有文化、地域或公司板块仍沿用旧卡片点击详情的失败。

- [ ] **Step 3: Migrate culture selection and entry**

文化卡片主体只设置 `state.selectedCulture` 并调用现有文化地图选择逻辑；增加右上角 `[data-map-enter-culture]` 按钮，路由进入 `#/culture/<key>`。保证文化筛选条件、地图关系图层和当前地图视口不因主体选择清除。

- [ ] **Step 4: Migrate region and company selection and entry**

地域卡片主体只更新 `selectedStateRegion`、`selectedStrategicRegion` 或 `selectedGeographicRegion`；公司卡片主体只更新 `selectedCompany`。分别增加对应进入按钮，统一调用详情路由函数。公司求解器和组合器的专用工具路由继续走原有路径，不被普通公司卡片进入按钮替换。

- [ ] **Step 5: Remove conflicting board-specific positioning**

在 `economy.css` 和 `records.css` 中保留公司、地域、文化各自的内容网格和字段样式，删除会覆盖共享 `.results`、`.detail` 三栏宽度的重复规则。为 `body.detail-page[data-view="culture"]`、`body.detail-page[data-view="region"]` 和 `body.detail-page[data-view="company"]` 保留必要的窄屏详情替换规则。

- [ ] **Step 6: Run map-board regression checks**

运行：`node scripts/check_shared_map_boards.mjs; node scripts/check_shared_map_boards_browser.mjs; node scripts/check_culture_mobile_narrow_screen_browser.mjs; node scripts/check_economy_board_browser.mjs; node scripts/check_interest_group_board_browser.mjs`

预期：四类地图板块交互合同通过，利益集团现有浏览器检查通过，宗教专用布局没有被共享规则改变。

- [ ] **Step 7: Commit the map boards**

```bash
git add site/app/boards.js site/app/economy.js site/app/map.js site/styles/records.css site/styles/economy.css site/styles/home.css scripts/check_shared_map_boards.mjs scripts/check_shared_map_boards_browser.mjs
git commit -m "feat: standardize map board selection states"
```

### Task 4: 统一意识形态、法律、科技、事件、日志和决议内容板块

**Files:**
- Modify: `site/app/boards.js` — 统一意识形态、法律、科技卡片和详情容器。
- Modify: `site/app/events.js` — 让事件卡片点击直接打开详情，并保留列表选中状态。
- Modify: `site/app/journals.js` — 让日志卡片点击直接打开详情。
- Modify: `site/app/decisions.js` — 让决议卡片点击直接打开详情。
- Modify: `site/styles/events.css` — 删除内容板块与共享详情定位冲突的规则，保留事件字段和分组样式。
- Modify: `site/styles/technology.css` — 保留科技树专用布局，接入统一详情状态。
- Modify: `site/styles/records.css` — 统一内容卡片的普通、悬停、选中和详情打开状态。
- Create: `scripts/check_content_board_interactions.mjs` — 静态内容板块合同。
- Create: `scripts/check_content_board_interactions_browser.mjs` — 桌面和窄屏内容板块验证。

**Interfaces:**
- Consumes `isContentView()` 和 `openDetailRoute()`。
- Produces内容板块统一的卡片点击详情、右栏显示、详情返回和窄屏列表替换行为。

- [ ] **Step 1: Write the failing content-board checks**

静态合同确认六个板块的卡片不输出 `[data-map-enter-*]` 或可见“进入”按钮，卡片点击绑定详情路由，详情返回绑定无条目键板块路由。浏览器检查覆盖 `#/ideology`、`#/law`、`#/technology`、`#/event`、`#/journal` 和 `#/decision`，点击首个卡片后确认详情出现；窄屏确认中部列表隐藏、详情替换列表并可返回。

- [ ] **Step 2: Run the checks and verify they fail**

运行：`node scripts/check_content_board_interactions.mjs; node scripts/check_content_board_interactions_browser.mjs`

预期：当前部分内容板块仍使用专用列表点击或详情布局，至少有一个板块不符合统一的详情状态合同。

- [ ] **Step 3: Convert content cards to direct detail actions**

保留各板块当前卡片字段和分组结构，将卡片点击统一为设置选中键、调用 `openDetailRoute(view, key)` 和 `render()`。不增加右上角进入按钮。详情栏继续调用现有详情渲染函数；详情返回按钮调用 `returnToBoardRoute(view)`，不清除搜索、筛选、排序和分页状态。

- [ ] **Step 4: Apply shared content layout states**

让内容模式无详情时隐藏空详情栏，中部列表使用剩余宽度；详情打开时显示右栏，卡片使用选中与详情打开状态。窄屏端通过 `body.detail-page` 隐藏列表并显示详情，返回后恢复列表滚动位置。科技树的画布和事件板块的分组导航保留现有专用结构，只接入共享详情开关。

- [ ] **Step 5: Run content and existing board checks**

运行：`node scripts/check_content_board_interactions.mjs; node scripts/check_content_board_interactions_browser.mjs; node scripts/check_technology_board_contract.mjs; node scripts/check_event_board_browser.mjs; node scripts/check_victorian_century_journal_browser.mjs`

预期：六个内容板块的卡片直达详情、返回和窄屏替换通过，科技、事件和日志既有字段与分组检查通过。

- [ ] **Step 6: Commit the content boards**

```bash
git add site/app/boards.js site/app/events.js site/app/journals.js site/app/decisions.js site/styles/events.css site/styles/technology.css site/styles/records.css scripts/check_content_board_interactions.mjs scripts/check_content_board_interactions_browser.mjs
git commit -m "feat: standardize content board details"
```

### Task 5: 实现窄屏地图“全屏/收起”视图

**Files:**
- Modify: `site/app/runtime.js` — 增加地图全屏前的列表滚动、筛选和视口快照。
- Modify: `site/app/ui.js` — 实现 `enterMapFullscreen()`、`exitMapFullscreen()` 和路由状态恢复。
- Modify: `site/app/map.js` — 进入全屏后重绘地图并恢复中心、缩放和图层。
- Modify: `site/index.html` — 完成“全屏”和“收起”按钮的可访问名称与位置。
- Modify: `site/styles/map.css` — 增加窄屏全屏地图布局，隐藏筛选栏和列表。
- Modify: `site/styles/shell.css` — 增加地图全屏状态下的页面高度和工具栏规则。
- Create: `scripts/check_mobile_map_fullscreen_browser.mjs` — 覆盖四类地图板块。

**Interfaces:**
- `enterMapFullscreen()` 保存 `{ view, listScrollTop, mapViewport, selectedKey, filters }` 并将哈希改为 `#/<view>?map=fullscreen`。
- `exitMapFullscreen()` 恢复快照并将哈希改为 `#/<view>`。
- `state.mapFullscreen` 不得改变 `state.detailKind`，全屏地图中区域点击不得打开详情。

- [ ] **Step 1: Write the failing browser check**

在 442×844 视口打开国家、文化、地域和公司板块，断言存在“全屏”按钮；点击后断言 `body[data-map-fullscreen="true"]`、列表和筛选栏隐藏、地图占满可用区域并存在“收起”按钮；点击地图区域后断言详情没有打开；点击“收起”后断言列表、筛选栏、选中卡片和地图焦点恢复。桌面端断言“全屏”按钮不显示。

- [ ] **Step 2: Run it and verify it fails**

运行：`node scripts/check_mobile_map_fullscreen_browser.mjs`

预期：失败，因为当前没有地图全屏路由和专用状态。

- [ ] **Step 3: Implement snapshot and route transitions**

在 `runtime.js` 增加 `state.mapFullscreenSnapshot`。`enterMapFullscreen()` 记录当前板块、列表滚动位置、筛选集合副本、选中键和 `mapRuntime.viewport`，使用 `replaceHash(`/${state.view}?map=fullscreen`)`；`exitMapFullscreen()` 还原快照并调用 `replaceHash(`/${state.view}`)`。`applyHash()` 读取查询参数，只有国家、文化、地域、公司且窄屏时进入全屏状态；无效参数回到普通地图模式。

- [ ] **Step 4: Implement narrow-screen rendering**

为地图工具绑定“全屏”和“收起”按钮。全屏状态下将 `body.dataset.mapFullscreen` 设为 `true`，隐藏筛选栏、列表、详情和普通页面工具，只保留地图标题、地图操作按钮和“收起”。地图区域点击调用普通选择函数，不调用任何详情路由。收起时恢复列表滚动位置，并在下一帧执行 `scrollTo` 和地图重绘。

- [ ] **Step 5: Run fullscreen and map regressions**

运行：`node scripts/check_mobile_map_fullscreen_browser.mjs; node scripts/check_country_map_list_focus_browser.mjs; node scripts/check_culture_mobile_narrow_screen_browser.mjs; node scripts/check_economy_board_browser.mjs`

预期：四类地图板块的全屏、收起、状态恢复和桌面隐藏合同通过。

- [ ] **Step 6: Commit the narrow-screen map view**

```bash
git add site/app/runtime.js site/app/ui.js site/app/map.js site/index.html site/styles/map.css site/styles/shell.css scripts/check_mobile_map_fullscreen_browser.mjs
git commit -m "feat: add narrow map fullscreen view"
```

### Task 6: 同步 Victorian Century 源目录和发布副本

**Files:**
- Modify: `scripts/build_victorian_century_site.mjs` — 确认共享页面构建时保留新的页面状态标记和样式版本。
- Modify: `scripts/check_victorian_century_standalone_site.mjs` — 增加主站与 VC 结构同步合同。
- Modify: `scripts/check_publish_bundle.mjs` — 检查发布副本包含同步后的共享脚本和样式。
- Regenerate: `Victorian Century Database/app/*`, `Victorian Century Database/styles/*`, `Victorian Century Database/index.html` — 由构建脚本从 `site/` 生成。
- Regenerate: `site/vc/*` — 由构建脚本生成发布副本。
- Create: `scripts/check_shared_layout_parity.mjs` — 比较主站、VC 源目录和发布副本中的共享脚本、样式合同。

**Interfaces:**
- Consumes主站已经通过的共享前端和现有 VC 数据、资产、配置。
- Produces Victorian Century 独立站和 `/vc/` 发布副本中的相同页面模式、卡片状态和窄屏全屏合同，同时保留 `vc-theme.css` 的主题覆盖。

- [ ] **Step 1: Write the failing parity contract**

合同比较 `site/app/runtime.js` 与两个 VC 输出目录的共享脚本，比较 `site/styles/foundation.css`、`shell.css`、`map.css`、`records.css` 与两个输出目录对应文件，确认包含相同的页面模式和按钮名称；确认 VC 仍保留 `vc-theme.css`，并且独立页不重新出现主站版本入口。

- [ ] **Step 2: Run it and verify it fails before regeneration**

运行：`node scripts/check_shared_layout_parity.mjs`

预期：失败，VC 输出目录尚未包含本轮共享布局修改。

- [ ] **Step 3: Regenerate both VC outputs**

运行：`node scripts/build_victorian_century_site.mjs --publish-target site/vc --skip-vc-assets`

该命令只同步共享前端和既有 VC 数据结构，不重建无关资产；若构建脚本需要新的样式缓存版本，在脚本中使用明确版本值更新主站复制逻辑。

- [ ] **Step 4: Run parity and standalone contracts**

运行：`node scripts/check_shared_layout_parity.mjs; node scripts/check_victorian_century_standalone_site.mjs; node scripts/check_publish_bundle.mjs`

预期：主站、Victorian Century 源目录和 `site/vc` 发布副本的共享布局合同通过。

- [ ] **Step 5: Commit synchronized outputs**

```bash
git add scripts/build_victorian_century_site.mjs scripts/check_victorian_century_standalone_site.mjs scripts/check_publish_bundle.mjs scripts/check_shared_layout_parity.mjs "Victorian Century Database" site/vc
git commit -m "build: synchronize shared layout with Victorian Century"
```

### Task 7: 全站回归、工作记录和交付审查

**Files:**
- Modify: `WORKLOG.md` — 增加简短索引。
- Create: `docs/worklog/2026-08-31-shared-layout-redesign.md` — 记录改动范围、验证结果和未部署状态。
- Review: `site/index.html`, `site/app/runtime.js`, `site/app/ui.js`, `site/app/boards.js`, `site/app/map.js`, `site/app/events.js`, `site/app/journals.js`, `site/app/decisions.js`, `site/styles/foundation.css`, `site/styles/shell.css`, `site/styles/map.css`, `site/styles/records.css`。

- [ ] **Step 1: Run static source and layout checks**

运行：`node scripts/check_frontend_file_split.mjs; node scripts/check_homepage_init_contract.mjs; node scripts/check_homepage_layout.mjs; node scripts/check_shared_layout_contract.mjs; node scripts/check_shared_map_boards.mjs; node scripts/check_content_board_interactions.mjs; node scripts/check_shared_layout_parity.mjs; node --check site/app/runtime.js; node --check site/app/ui.js; node --check site/app/boards.js; git diff --check`

预期：所有合同、语法和空白检查退出码为 0。

- [ ] **Step 2: Run desktop browser regression**

启动本地静态站点后运行：`node scripts/check_homepage_tools_browser.mjs`; `node scripts/check_country_shared_layout_browser.mjs`; `node scripts/check_shared_map_boards_browser.mjs`; `node scripts/check_content_board_interactions_browser.mjs`; `node scripts/check_event_board_browser.mjs`; `node scripts/check_interest_group_board_browser.mjs`。

预期：首页仍为独立首页，四类地图板块主体选择不打开详情，进入按钮打开详情，六类内容板块点击直接打开详情，利益集团和宗教现有设计通过。

- [ ] **Step 3: Run narrow-screen regression**

运行：`node scripts/check_mobile_map_fullscreen_browser.mjs`; `node scripts/check_country_mobile_narrow_screen_browser.mjs`; `node scripts/check_culture_mobile_narrow_screen_browser.mjs`; `node scripts/check_country_map_list_focus_browser.mjs`。

预期：地图“全屏/收起”、详情替换列表、返回状态恢复、列表滚动恢复和无横向溢出全部通过；桌面端不显示“全屏”按钮。

- [ ] **Step 4: Run Victorian Century browser regression**

运行：`node scripts/check_victorian_century_main_entry_browser.mjs`; `node scripts/check_victorian_century_content_browser.mjs`; `node scripts/check_victorian_century_company_tools_browser.mjs`; `node scripts/check_shared_layout_parity.mjs`。

预期：Victorian Century 独立站标题、数据、主题覆盖、地图板块、内容板块和发布副本合同通过。

- [ ] **Step 5: Review git scope before recording work**

运行：`git status --short --branch; git diff --stat; git diff --cached --stat; git log --oneline -8`，确认本轮只包含计划文件、共享布局实现、合同、同步输出和工作记录，不包含用户原有未提交文件。

- [ ] **Step 6: Record the handoff**

在 `docs/worklog/2026-08-31-shared-layout-redesign.md` 记录目标、完成阶段、未解决问题、实际修改文件、每条验证命令及结果，`WORKLOG.md` 只增加链接索引。明确区分本地完成、是否提交、是否推送和是否公开部署。

- [ ] **Step 7: Final review and handoff**

按设计文档逐项核对：配色未改；利益集团和宗教未重做；地图模式与内容模式边界成立；国家、文化、地域、公司主体点击只选择；地图模式进入按钮打开详情；内容模式卡片点击打开详情；窄屏“全屏/收起”状态可恢复；VC 源目录和发布副本同步。完成后再决定是否进入推送或部署流程。
