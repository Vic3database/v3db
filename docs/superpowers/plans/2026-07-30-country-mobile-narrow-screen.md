# 国家板块窄屏适配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 390×844 手机竖屏下提供国家板块的单行查询工具栏、可收起筛选与地图，以及可恢复原列表状态的详情阅读页。

**Architecture:** 继续使用 `site/app/runtime.js` 中的集中状态和既有哈希路由。窄屏国家页在 `site/app/ui.js` 中维护页面级显示状态与列表滚动快照，在 `site/app/presentation.js` 中渲染条件标签输入框并将每个分类收敛为单个选择。样式只在 `@media (max-width: 820px)` 覆盖国家板块，不改变桌面端面板。

**Tech Stack:** 原生 HTML、CSS、JavaScript；Node 静态契约检查；通过 Chrome DevTools 协议执行的浏览器回归检查。

---

### Task 1: 写入设计记录并建立静态契约

**Files:**

- Create: `docs/superpowers/specs/2026-07-30-country-mobile-narrow-screen-design.md`
- Create: `scripts/check_country_mobile_narrow_screen_contract.mjs`
- Modify: `site/index.html`
- Modify: `site/app/runtime.js`
- Modify: `site/styles/shell.css`

- [x] **Step 1: 写入失败的静态契约**

在 `scripts/check_country_mobile_narrow_screen_contract.mjs` 中读取上述三个前端文件，断言尚不存在的手机国家工具栏、`countryMobileFiltersOpen`、`countryMobileMapOpen`、`countryMobileListScrollTop`、`mobile-country-filter-panel` 和移动详情隐藏规则。

- [x] **Step 2: 运行静态契约并确认失败**

运行：`node scripts/check_country_mobile_narrow_screen_contract.mjs`

预期：以缺少国家窄屏工具栏或运行时状态的断言失败。

- [x] **Step 3: 建立最小结构和状态**

在 `site/index.html` 添加默认隐藏的国家窄屏工具栏及其筛选面板容器；在 `site/app/runtime.js` 中添加三个状态；在 `site/styles/shell.css` 的 820 像素断点内添加显示和隐藏选择器。

- [x] **Step 4: 再次运行静态契约并确认通过**

运行：`node scripts/check_country_mobile_narrow_screen_contract.mjs`

预期：退出状态为 0，输出国家窄屏静态契约通过。

### Task 2: 实现国家条件标签和单选分类

**Files:**

- Modify: `site/app/runtime.js`
- Modify: `site/app/presentation.js`
- Modify: `site/app/ui.js`
- Modify: `site/styles/shell.css`
- Test: `scripts/check_country_mobile_narrow_screen_contract.mjs`

- [x] **Step 1: 扩展失败的静态契约**

在契约中断言有“类型、位阶、战略区域、传承、语言、传统”分类常量，且存在按分类替换条件、渲染可删除条件标签和横向滚动输入框的代码标识。

- [x] **Step 2: 运行契约并确认失败**

运行：`node scripts/check_country_mobile_narrow_screen_contract.mjs`

预期：以缺少分类单选或条件标签渲染逻辑失败。

- [x] **Step 3: 实现最小筛选交互**

为六个分类映射既有 `state` 筛选字段；每类只保存一个键，不同类字段继续同时参与现有筛选函数。渲染输入框内的可删除标签，处理点击选项替换同类条件、点击已选项取消、点击“×”清除对应条件。关键词保留在所有标签之后，输入框设置 `overflow-x: auto`、`white-space: nowrap` 和 `touch-action: pan-x`。

- [x] **Step 4: 再次运行静态契约并确认通过**

运行：`node scripts/check_country_mobile_narrow_screen_contract.mjs`

预期：退出状态为 0。

### Task 3: 实现地图与筛选开关，以及详情返回恢复

**Files:**

- Modify: `site/app/ui.js`
- Modify: `site/app/presentation.js`
- Modify: `site/styles/shell.css`
- Test: `scripts/check_country_mobile_narrow_screen_contract.mjs`

- [x] **Step 1: 扩展失败的静态契约**

断言地图和筛选两个按钮分别更新状态，国家详情路由进入时保存页面滚动位置，返回国家列表时恢复该位置，且窄屏详情页隐藏列表和地图。

- [x] **Step 2: 运行契约并确认失败**

运行：`node scripts/check_country_mobile_narrow_screen_contract.mjs`

预期：以缺少开关或列表滚动恢复逻辑失败。

- [x] **Step 3: 实现最小详情与面板状态逻辑**

点击地图和筛选工具栏按钮分别切换状态和 `body.dataset` 标记。进入 `#/country/<TAG>` 前记录页面 `scrollY`；返回 `#/country` 后在渲染完成的下一帧恢复。窄屏详情路由使用可回退的历史记录，显示详情文章并隐藏工具栏、筛选、地图和结果列表。

- [x] **Step 4: 再次运行静态契约并确认通过**

运行：`node scripts/check_country_mobile_narrow_screen_contract.mjs`

预期：退出状态为 0。

### Task 4: 建立移动浏览器回归检查并手工验证

**Files:**

- Create: `scripts/check_country_mobile_narrow_screen_browser.mjs`
- Test: `scripts/check_country_mobile_narrow_screen_browser.mjs`

- [x] **Step 1: 写入失败的浏览器回归检查**

创建浏览器脚本，通过 Chrome DevTools 协议设置 390×844 移动视口并打开本地 `#/country`，断言国家工具栏位于地图之前、类型选项按可用宽度自然换行、国家工具栏与地图初始可见、筛选初始隐藏。脚本随后断言筛选打开、类型选择被替换、位阶可共存、地图收起、详情进入和返回按钮或浏览器后退后的列表滚动恢复。

- [x] **Step 2: 运行浏览器检查并确认失败**

运行：`node scripts/check_country_mobile_narrow_screen_browser.mjs`

预期：以找不到国家窄屏元素或交互状态失败。

- [x] **Step 3: 补齐必要的可访问名称和数据属性**

为浏览器检查添加稳定的 `data-*` 属性和 `aria-label`，不依赖文字样式或 CSS 类顺序。

- [x] **Step 4: 运行浏览器检查并确认通过**

运行：`node scripts/check_country_mobile_narrow_screen_browser.mjs`

预期：退出状态为 0，输出国家窄屏浏览器检查通过。

- [x] **Step 5: 手工检查**

运行：`python -m http.server 8877 --directory site`，在浏览器打开 `http://127.0.0.1:8877/#/country` 并启用 390×844 设备模拟。依次检查默认地图、收起地图、展开筛选、同类替换、跨类并存、标签删除、详情全屏与返回位置。

### Task 5: 全量验证与提交

**Files:**

- Modify: 上述所有实现与测试文件

- [x] **Step 1: 运行完整验证**

运行：`node --check site/app/runtime.js`、`node --check site/app/filters.js`、`node --check site/app/presentation.js`、`node --check site/app/ui.js`、`node scripts/check_country_mobile_narrow_screen_contract.mjs`、`node scripts/check_country_mobile_narrow_screen_browser.mjs`、`git diff --check`。

预期：全部退出状态为 0。

- [x] **Step 2: 检查最终差异**

运行：`git diff --check` 与 `git status --short`。

预期：只出现国家窄屏适配的前端、检查脚本和设计记录。

- [x] **Step 3: 提交实现**

运行：`git add docs/superpowers/specs/2026-07-30-country-mobile-narrow-screen-design.md docs/superpowers/plans/2026-07-30-country-mobile-narrow-screen.md site/index.html site/styles/shell.css site/app/runtime.js site/app/filters.js site/app/presentation.js site/app/ui.js scripts/check_country_mobile_narrow_screen_contract.mjs scripts/check_country_mobile_narrow_screen_browser.mjs && git commit -m "feat: adapt country board for narrow screens"`

预期：创建一个只包含本轮国家窄屏适配的提交。

### Task 6: 细化窄屏工具栏和筛选布局

**Files:**

- Modify: `site/styles/shell.css`
- Modify: `scripts/check_country_mobile_narrow_screen_contract.mjs`
- Modify: `scripts/check_country_mobile_narrow_screen_browser.mjs`

- [x] **Step 1: 写入失败断言**

在浏览器回归检查中验证 390×844 与 640×844 视口均完整显示搜索提示文字；验证窄屏地图只保留重置视角按钮；验证分类行下方存在分隔线，且每行选项从选项容器左边缘开始。静态检查同步要求对应的样式规则。

- [x] **Step 2: 运行断言并确认失败**

运行：`node scripts/check_country_mobile_narrow_screen_browser.mjs`

预期：搜索提示宽度、地图工具栏或选项排列的至少一项断言失败。

- [x] **Step 3: 调整最小样式范围**

在 `@media (max-width: 820px)` 的国家板块规则中，将搜索输入的最小宽度设为 `148px` 并允许填满剩余空间；隐藏 `#leftPanelToggle` 和 `#bottomPanelToggle`，保留 `#mapFitWidthButton`；为 `.mobile-country-filter-categories` 添加底部分隔线；将 `.mobile-country-filter-options` 改为 `justify-content: flex-start`。

- [x] **Step 4: 运行回归检查并确认通过**

运行：`node scripts/check_country_mobile_narrow_screen_contract.mjs` 与 `node scripts/check_country_mobile_narrow_screen_browser.mjs`

预期：两个脚本均以状态码 0 退出。

- [x] **Step 5: 提交**

运行：`git add docs/superpowers/plans/2026-07-30-country-mobile-narrow-screen.md site/styles/shell.css scripts/check_country_mobile_narrow_screen_contract.mjs scripts/check_country_mobile_narrow_screen_browser.mjs && git commit -m "fix: refine narrow country toolbar"`

预期：创建只包含本轮三项窄屏调整和回归检查的提交。

### Task 7: 国家窄屏搜索改为显式提交

**Files:**

- Modify: `site/app/runtime.js`
- Modify: `site/app/ui.js`
- Modify: `site/app/presentation.js`
- Modify: `scripts/check_country_mobile_narrow_screen_contract.mjs`
- Modify: `scripts/check_country_mobile_narrow_screen_browser.mjs`

- [x] **Step 1: 写入失败断言**

浏览器检查在输入无结果关键词后要求国家总数保持不变，再点击放大镜并等待空列表；清空输入后按回车恢复列表。静态检查要求待提交搜索词和独立提交函数，并禁止输入事件直接写入 `state.search`。

- [x] **Step 2: 运行断言并确认失败**

运行：`node scripts/check_country_mobile_narrow_screen_browser.mjs`

预期：输入关键词时列表仍会立即变为空，断言失败。

- [x] **Step 3: 实现待提交搜索词**

在 `state` 添加 `countryMobileSearchDraft`。窄屏输入事件只更新该字段，不调用 `render()`；点击搜索和普通回车调用 `submitMobileCountrySearch()`，该函数将待提交词写入 `state.search`、同步桌面搜索框并重绘。筛选面板重绘继续显示待提交词。

- [x] **Step 4: 运行回归检查并确认通过**

运行：`node scripts/check_country_mobile_narrow_screen_contract.mjs` 与 `node scripts/check_country_mobile_narrow_screen_browser.mjs`

预期：两个脚本均以状态码 0 退出。

- [x] **Step 5: 提交**

运行：`git add docs/superpowers/plans/2026-07-30-country-mobile-narrow-screen.md site/app/runtime.js site/app/ui.js site/app/presentation.js scripts/check_country_mobile_narrow_screen_contract.mjs scripts/check_country_mobile_narrow_screen_browser.mjs && git commit -m "fix: submit narrow country search explicitly"`

预期：创建只包含国家窄屏搜索提交交互的提交。
