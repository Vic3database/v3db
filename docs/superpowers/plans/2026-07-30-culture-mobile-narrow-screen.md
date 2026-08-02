# 文化板块竖屏适配实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在宽度不超过高度 1.5 倍的视口中，为文化板块提供可提交搜索、分层筛选、可折叠文化地图、列表选中和详情状态恢复。

**Architecture:** 国家与文化共用紧凑工具栏的布局、搜索标签容器、按钮和地图位置。文化保留独立状态、分类与事件处理；传承组、语言组和洲别只决定展开内容，具体传承、具体语言、传统和具体战略区域才构成实际条件。选中列表卡片时，地图显示文化关系并聚焦本土地域；无选中项时，实际条件驱动文化筛选地图。

**Tech Stack:** 原生 JavaScript、静态 HTML、CSS Media Queries、Node.js `assert`、Chrome DevTools Protocol。

---

## 执行前约束

当前工作区有无关的未提交资源统计修改：`site/app/components.js`、`site/app/map.js`、`site/index.html` 和 `scripts/check_discoverable_resource_totals.mjs`。其中 `site/app/map.js` 与 `site/index.html` 会与本任务重叠。开始前保存差异；修改时只追加独立区块；暂存时对这两个重叠文件使用 `git add -p`，不得还原、格式化或一并提交资源统计修改。

### Task 1: 建立文化竖屏回归测试

**Files:**

- Create: `scripts/check_culture_mobile_narrow_screen_contract.mjs`
- Create: `scripts/check_culture_mobile_narrow_screen_browser.mjs`
- Reference: `scripts/check_country_mobile_narrow_screen_contract.mjs`
- Reference: `scripts/check_country_mobile_narrow_screen_browser.mjs`

- [ ] **Step 1: 确认工作区基线**

运行 `git diff -- site/app/components.js site/app/map.js site/index.html` 和 `git status --short`。预期只显示已知资源统计差异和未跟踪目录，暂存区为空。

- [ ] **Step 2: 写入会失败的静态契约**

静态脚本读取 `site/index.html`、`site/app/runtime.js`、`site/app/ui.js`、`site/app/boards.js`、`site/app/presentation.js`、`site/app/map.js`、`site/app/filters.js` 与 `site/styles/shell.css`。要求存在 `mobileCultureToolbar`、`mobileCultureFilterPanel`、文化独立的默认开关状态与三个展开状态、`renderMobileCultureControls`、`selectCultureMobileFilter`、`submitMobileCultureSearch`、`focusCultureOnMap`，并要求在 `@media (max-aspect-ratio: 3 / 2)` 中显示文化工具栏。

契约还要求组和洲别使用独立数据属性，具体项使用 `data-mobile-culture-filter-option`；关闭筛选时完全隐藏面板；选项自然换行；搜索区横向滚动；详情隐藏工具栏、地图、筛选栏和列表；重置地图按钮位于右上；列表和地图保留相同左右边距。

- [ ] **Step 3: 写入会失败的浏览器回归**

复制国家页浏览器检查的 Chrome/CDP 辅助函数，起始路由改为 `#/culture`。回归覆盖 390×844、1200×900 和 1600×900；前两种视口显示工具栏，最后一种隐藏工具栏。检查默认筛选关闭和默认地图展开；输入不即时筛选，搜索按钮和回车提交；传承组、语言组和洲别只展开不生成标签；具体传承、具体语言、传统和具体战略区域生成标签且取交集；列表卡片只选中并更新地图，箭头进入详情；详情返回按钮和浏览器后退恢复筛选、展开状态、地图和滚动位置。

- [ ] **Step 4: 执行红灯检查**

先在后台启动本地站点，再运行以下命令：

```powershell
$server = Start-Process -FilePath 'python' -ArgumentList '-m','http.server','8877','--directory','site' -WorkingDirectory 'D:\Bot\Vic3\Victoria3_DB' -WindowStyle Hidden -PassThru
node scripts/check_culture_mobile_narrow_screen_contract.mjs
node scripts/check_culture_mobile_narrow_screen_browser.mjs http://127.0.0.1:8877/index.html
Stop-Process -Id $server.Id
```

预期静态检查报告缺少文化容器、状态和样式，浏览器检查在寻找 `#mobileCultureToolbar` 时失败。

- [ ] **Step 5: 提交测试骨架**

仅暂存两个新测试脚本，执行 `git diff --cached --check` 后提交，提交信息为 `test: define culture mobile contract`。

### Task 2: 实现文化状态、搜索和分层筛选

**Files:**

- Modify: `site/index.html:75-76`
- Modify: `site/app/runtime.js:123-178, 684-730`
- Modify: `site/app/presentation.js:47-151`
- Modify: `site/app/ui.js:34-39, 83-138, 220-258, 1185-1190`
- Modify: `site/app/filters.js:33-44, 146-180`

- [ ] **Step 1: 添加文化容器和独立状态**

在国家工具栏之后新增 `mobileCultureToolbar` 和 `mobileCultureFilterPanel`，两者共有 `mobile-board-*` 类并分别保留文化专用类。`state` 与 `els` 添加：`cultureMobileFiltersOpen`、`cultureMobileMapOpen`、`cultureMobileListScrollTop`、`cultureMobileSearchDraft`、`cultureMobileFilterCategory`、`cultureMobileExpandedHeritageGroup`、`cultureMobileExpandedLanguageGroup`、`cultureMobileExpandedStrategicRegionContinent`、`cultureMobileRestoreScrollPending`。`render()` 写入三个文化数据属性；重置筛选只恢复文化字段，不改变国家窄屏状态。

- [ ] **Step 2: 分离实际条件与展开状态**

在 `site/app/filters.js` 提取文化共同筛选谓词，保留桌面端已有的传承组和语言组多选：

```js
function matchesCultureSelection(culture) {
  if (!matchesRefSet(state.strategicRegions, culture.homeland_strategic_regions)) return false;
  if (!matchesRefSet(state.heritageGroups, compactRefs([culture.heritage_group]))) return false;
  if (!matchesRefSet(state.heritages, compactRefs([culture.heritage]))) return false;
  if (!matchesRefSet(state.languageGroups, compactRefs([culture.language_group]))) return false;
  if (!matchesRefSet(state.languages, compactRefs([culture.language]))) return false;
  if (state.tradition && !(culture.traditions || []).some((trait) => trait.key === state.tradition)) return false;
  return true;
}
```

`matchesCultureFilters()` 继续保留版本变化、原住民语言和关键词检查，再调用这个谓词。文化窄屏的传承组、语言组和洲别操作不得写入 `heritageGroups` 或 `languageGroups`；因此它们只控制展开，移动端的实际筛选仍只来自具体项。

- [ ] **Step 3: 渲染四个分类**

在 `site/app/presentation.js` 定义传承、语言、传统、本土战略区域四个分类。`renderMobileCultureControls()` 使用共用工具栏骨架渲染搜索标签、搜索按钮、筛选按钮与地图按钮。筛选关闭时清空面板并设为 `hidden`。传承和语言先显示组，选中组后在第二条分隔线下显示该组具体项和“不限”；战略区域按 `strategicRegionContinentGroups` 显示洲别，再显示当前洲内非海域区域；传统直接显示具体项。实际条件短名移除末尾的“传承”“语言”“语支”“语族”，仅在短名冲突时加全角分类括号。

- [ ] **Step 4: 绑定显式搜索与筛选事件**

文化输入只更新 `cultureMobileSearchDraft`。搜索按钮和回车调用 `submitMobileCultureSearch`，将待提交词规范化后写入 `state.search` 并重新渲染。分类按钮切换当前分类；组与洲别按钮只切换展开状态。`selectCultureMobileFilter(category, value)` 先清除同类旧实际条件，再写入新值；再次点击同值或“不限”清除该类。删除搜索标签只清除实际条件，保持组和洲别的展开状态。

- [ ] **Step 5: 检查并提交交互层**

运行 `node --check` 检查 `runtime.js`、`ui.js`、`presentation.js`、`filters.js`，再运行文化静态契约。预期均通过。暂存上述四个脚本与静态契约；`site/index.html` 仅通过 `git add -p` 暂存文化容器；运行 `git diff --cached --check`，提交信息为 `feat: add culture mobile filters`。

### Task 3: 应用紧凑布局和文化地图行为

**Files:**

- Modify: `site/styles/shell.css:1218-1530`
- Modify: `site/styles.css:5-8`
- Modify: `site/index.html:7, 297-301`
- Modify: `site/app/boards.js:558-566`
- Modify: `site/app/presentation.js:293-342, 883-886`
- Modify: `site/app/ui.js:34-39, 271-276`
- Modify: `site/app/map.js:34-44, 148-180, 810-825, 1120-1138`

- [ ] **Step 1: 将国家单列布局扩展到文化**

在现有 `@media (max-aspect-ratio: 3 / 2)` 中，文化与国家都采用工具栏、筛选面板、地图、列表的 1、2、3、4 顺序。文化地图高度为 `min(42vh, 340px)`；地图和列表宽度为 `calc(100% - 20px)`，左右各保留 10 像素。地图工具栏使用 `top: 10px; right: 10px; left: auto`；隐藏 `#leftPanelToggle` 和 `#bottomPanelToggle`；筛选关闭时无边框和空白。

文化使用共用的 `mobile-board-toolbar`、`mobile-board-filter-panel`、`mobile-board-search-input`、`mobile-board-filter-categories`、`mobile-board-filter-options` 样式，保留国家旧类作为兼容别名。共用样式必须维持标签搜索区横向滚动、分类横向滚动、具体项自然换行、圆角矩形边框、分类分隔线和 8 像素选项上间距。

- [ ] **Step 2: 添加地图开关与详情隐藏规则**

增加文化选择器：`data-culture-mobile-map="false"` 时隐藏地图；`data-culture-mobile-detail="open"` 时隐藏文化工具栏、文化筛选面板、地图、桌面筛选栏和列表。根 `index.html` 与 `styles.css` 同步提升样式、运行时、界面、列表、筛选和地图脚本的查询版本，避免缓存加载旧资源。

- [ ] **Step 3: 接入文化列表选中和地图聚焦**

`renderCultureBoard()` 在渲染列表后调用 `renderMap(stateRegions)` 和 `focusCultureOnMap(selectedCulture)`。在 `site/app/map.js` 增加 `focusCultureOnMap(culture)`：仅在文化视图、地图已就绪且文化存在时，将 `culture.homeland_state_regions` 的键传给 `focusStateRegionsOnMap`，使用 `maxWorldScale: 2.1` 与 `padding: 280`。`syncMapModeForView()` 在有选中文化时优先使用 `culture` 模式并设定 `mapSubject`；无选中项而 `hasCultureSelection()` 为真时使用 `cultureFilter`。`hasCultureSelection()` 与 `matchingHomelandCulturesForFilters()` 都复用 `matchesCultureSelection()`；文化筛选地图的图层签名加入 `state.strategicRegions`，使本土战略区域同步影响高亮。

- [ ] **Step 4: 区分卡片选中、详情与返回**

`selectCultureCard()` 保持 `#/culture` 路由，更新 `aria-current` 和地图，不进入详情。`openCultureDetail()` 在紧凑视口保存 `cultureMobileListScrollTop` 后设为 `#/culture/<KEY>`。`detailBackButton("culture")` 输出 `data-culture-mobile-detail-back`。点击返回与浏览器后退从文化详情回到列表时设置 `cultureMobileRestoreScrollPending`；`renderCultureBoard()` 在下一帧恢复 `window.scrollTo(0, state.cultureMobileListScrollTop)` 后清除标记。

- [ ] **Step 5: 本地浏览器回归**

启动 `python -m http.server 8877 --directory site`，运行文化和国家浏览器检查。预期文化在 390×844、1200×900 显示工具栏并默认显示地图，在 1600×900 隐藏工具栏；国家检查继续通过。停止本地服务后运行 `node --check` 检查 `runtime.js`、`ui.js`、`boards.js`、`presentation.js`、`filters.js`、`map.js`，再运行两个静态契约、`check_news_board.mjs` 和 `git diff --check`。

- [ ] **Step 6: 检查重叠差异并提交**

再次执行 `git diff -- site/app/components.js site/app/map.js site/index.html`，确认资源统计差异仍在、文化差异独立。暂存样式、`boards.js`、`presentation.js`、`ui.js`、`filters.js`、两个文化测试脚本；对 `map.js` 和 `index.html` 使用 `git add -p`。运行 `git diff --cached --check` 后提交，提交信息为 `feat: complete culture mobile interactions`。

### Task 4: 发布、公开回归和记录

**Files:**

- Modify: `WORKLOG.md`
- Modify: `docs/worklog/2026-07-30.md`
- Deploy: `site/index.html`, `site/styles.css`, `site/styles/shell.css`, `site/app/runtime.js`, `site/app/ui.js`, `site/app/boards.js`, `site/app/presentation.js`, `site/app/filters.js`, `site/app/map.js`

- [ ] **Step 1: 安全增量发布**

以当前活动站点为硬链接基线创建唯一服务器暂存目录。每个部署文件先上传为暂存目录根下的 `.new` 文件，逐个比较本地和服务器 SHA-256，再在暂存目录内移动到最终路径。不得直接覆盖 `/var/www/vicdata/site` 或硬链接的子路径。

- [ ] **Step 2: 原子切换并检查公开资源**

使用 `scripts/deploy-vicdata.sh` 切换暂存目录。读取公开 `index.html`、`styles.css`、`styles/shell.css` 和改动脚本，核对新资源版本、`max-aspect-ratio: 3 / 2` 与文化工具栏标识。运行文化和国家公开浏览器检查，预期两者返回 0，并记录精确回退目录。

- [ ] **Step 3: 写入工作记录并提交**

在 `WORKLOG.md` 写入文化紧凑布局、四类实际条件、文化地图高亮、公开回归和回退目录。在 `docs/worklog/2026-07-30.md` 追加红绿测试过程、替换文件、SHA-256、公开回归、代码提交和回退目录。只暂存详细记录，运行 `git diff --cached --check` 后提交，提交信息为 `docs: record culture mobile release`。`WORKLOG.md` 受忽略规则保护，保留在工作区，不纳入提交。
