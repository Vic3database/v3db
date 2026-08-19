# Victorian Century 内容板块拆分实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 Victorian Century 独立站的日志、事件、决议拆为三个独立三栏板块，并为 VC 新增与 VC 调整内容提供准确标签。

**Architecture:** 保留现有事件板作为事件板的唯一渲染入口，独立站通过合并后的 VC 事件数据块替换事件数据；日志和决议各自新增专用渲染器、筛选器、路由和详情模板。构建阶段为所有合并内容写入 `vc_change_kind`，前端只消费这个字段，不根据文件名或分组推断标签。

**Tech Stack:** 原生 JavaScript、静态 HTML/CSS、Node.js 数据构建脚本、Chrome DevTools Protocol 浏览器检查。

---

### Task 1: 建立 VC 变更字段与回归契约

**Files:**
- Modify: `scripts/build_victorian_century_content.mjs`
- Modify: `scripts/build_victorian_century_content_site_data.mjs`
- Create: `scripts/check_victorian_century_content_change_contract.mjs`
- Modify: `database/victorian_century/*.json`（由构建命令生成）

- [ ] **Step 1: 写失败契约测试**

在 `check_victorian_century_content_change_contract.mjs` 中读取合并数据并断言：事件新增 682、事件调整 26；日志包含 `je_agricultural_development` 且为 `adjusted`，VC 独有日志为 `added`；原版日志不带 VC 变更字段；决议保留现有来源统计。

- [ ] **Step 2: 运行契约测试确认失败**

运行 `node scripts/check_victorian_century_content_change_contract.mjs`，预期因合并数据没有 `vc_change_kind` 而失败。

- [ ] **Step 3: 实现构建阶段判定**

在 `mergeRows` 中保留原版行，遇到 VC 独有行写入 `vc_change_kind: "added"`；遇到同 ID 行时比较 `raw` 和 `locales`，仅有差异才写入 `vc_change_kind: "adjusted"`，完全相同则不写入。所有带 VC 来源的行保留 `sources` 和 `source_files`。

- [ ] **Step 4: 运行构建并确认契约通过**

运行 `node scripts/build_victorian_century_content.mjs`，再运行 `node scripts/check_victorian_century_content_change_contract.mjs`，预期输出新增和调整数量均符合上述断言。

### Task 2: 将合并事件接入现有事件板

**Files:**
- Modify: `scripts/build_victorian_century_content_site_data.mjs`
- Modify: `site/app/events.js`
- Modify: `site/app/data.js`
- Modify: `site/app/runtime.js`
- Modify: `site/app/ui.js`
- Modify: `site/index.html`
- Modify: `site/locales/ui.zh-Hans.js`
- Modify: `site/locales/ui.en.js`
- Modify: `site/styles/events.css`
- Modify: `scripts/check_victorian_century_content_browser.mjs`

- [ ] **Step 1: 写失败浏览器契约**

将内容浏览器检查改为打开 `#/event`，断言独立站显示 2,946 张事件卡片，保留事件类型、通用／风味、事件标签、事件组和搜索筛选；断言带 `sources: ["vc"]` 的事件显示 VC 新增，带 `sources: ["vanilla", "vc"]` 且 `vc_change_kind: "adjusted"` 的事件显示 VC 调整，并能打开右栏详情。

- [ ] **Step 2: 运行检查确认失败**

运行 `node scripts/check_victorian_century_content_browser.mjs`，预期当前独立站仍进入旧的内容板，事件数量不是 2,946。

- [ ] **Step 3: 让 VC 事件数据使用现有事件格式**

在 `build_victorian_century_content_site_data.mjs` 中将合并事件转换为现有 `events.js` 所需字段：`key`、`namespace`、`event_type`、`event_kind`、`tags`、`loc`、`locales`、`options.modifiers`、`script`、`source_file`、`source_line` 和 `vc_change_kind`。复用事件分类、标签和修正解析模块，确保原版站点仍使用原版事件数据块。

- [ ] **Step 4: 让事件板显示 VC 标签**

在 `eventCardHtml` 和 `renderEventDetail` 中渲染 `vc_change_kind` 对应的 `vc.badge.added` 或 `vc.badge.adjusted` 标签；新增事件板变更筛选，筛选只按字段匹配，不影响原有事件类型、性质、标签和事件组筛选。

- [ ] **Step 5: 切换独立站事件路由和数据块**

让独立站 `event` 数据块优先读取合并事件文件，移除独立站对旧 `content` 事件列表的依赖；保留 `#/content/event` 到 `#/event` 的兼容重定向。导航文本改为“事件”，事件板仍使用既有三栏布局。

- [ ] **Step 6: 运行事件浏览器检查确认通过**

运行 `node scripts/check_victorian_century_content_browser.mjs`，确认数量、筛选、VC 标签、卡片选择和详情全部通过。

### Task 3: 新增日志独立板块

**Files:**
- Create: `site/app/journals.js`
- Modify: `site/app/runtime.js`
- Modify: `site/app/data.js`
- Modify: `site/app/ui.js`
- Modify: `site/index.html`
- Modify: `site/locales/ui.zh-Hans.js`
- Modify: `site/locales/ui.en.js`
- Modify: `site/styles/events.css`
- Create: `scripts/check_victorian_century_journal_browser.mjs`

- [ ] **Step 1: 写失败浏览器契约**

断言 `#/journal` 显示 856 条日志，左栏含搜索、来源、VC 变更和日志组导航，中栏按日志组与 ID 排序，卡片显示 VC 标签，点击后右栏出现日志说明和条件详情。

- [ ] **Step 2: 运行检查确认失败**

运行 `node scripts/check_victorian_century_journal_browser.mjs`，预期路由尚未存在。

- [ ] **Step 3: 实现日志板筛选与排序**

新增 `journalRows`、`journalVisible`、日志组导航和 `journalCardHtml`。排序键为日志组名称、日志 ID；筛选支持搜索、`vanilla`／`vc` 来源和 `added`／`adjusted` VC 标签。

- [ ] **Step 4: 实现日志详情**

详情显示本地化名称、说明、日志组、VC 标签、显示条件、开启条件、完成条件、失败条件、完成／失败／超时效果、触发事件、来源文件和原始脚本。

- [ ] **Step 5: 接入路由、导航和三栏样式**

新增 `journal` 数据块加载、`#/journal` 路由、导航按钮和独立筛选栏，沿用事件板的结果区与详情区定位规则，不显示地图筛选器。

- [ ] **Step 6: 运行日志浏览器检查确认通过**

运行 `node scripts/check_victorian_century_journal_browser.mjs`，确认 856 条日志、分组排序、VC 标签和详情内容通过。

### Task 4: 新增决议独立板块

**Files:**
- Create: `site/app/decisions.js`
- Modify: `site/app/runtime.js`
- Modify: `site/app/data.js`
- Modify: `site/app/ui.js`
- Modify: `site/index.html`
- Modify: `site/locales/ui.zh-Hans.js`
- Modify: `site/locales/ui.en.js`
- Modify: `site/styles/events.css`
- Create: `scripts/check_victorian_century_decision_browser.mjs`

- [ ] **Step 1: 写失败浏览器契约**

断言 `#/decision` 显示 102 条决议，支持搜索、来源筛选和分组导航；点击决议后右栏显示说明、显示条件、执行条件、执行效果、AI 权重、触发事件、来源文件和原始脚本。

- [ ] **Step 2: 运行检查确认失败**

运行 `node scripts/check_victorian_century_decision_browser.mjs`，预期路由尚未存在。

- [ ] **Step 3: 实现决议板和详情**

新增决议数据行转换、按来源文件和 ID 排序、搜索和来源筛选。详情使用决议字段 `is_shown_raw`、`possible_raw`、`when_taken_raw`、`ai_chance_raw` 和 `triggered_event_ids`。

- [ ] **Step 4: 接入路由、导航和三栏样式**

新增 `decision` 数据块加载、`#/decision` 路由、导航按钮和独立筛选栏；保留 `#/content/decision` 兼容重定向。

- [ ] **Step 5: 运行决议浏览器检查确认通过**

运行 `node scripts/check_victorian_century_decision_browser.mjs`，确认 102 条决议、分组、筛选和右栏详情通过。

### Task 5: 删除旧内容板入口并完成整体验证

**Files:**
- Modify: `site/app/content.js`
- Modify: `site/app/boards.js`
- Modify: `site/app/ui.js`
- Modify: `site/app/runtime.js`
- Modify: `site/index.html`
- Modify: `scripts/check_victorian_century_standalone_site.mjs`
- Modify: `scripts/check_victorian_century_main_entry.mjs`
- Modify: `docs/worklog/2026-08-15-victorian-century-content-merge.md`
- Modify: `WORKLOG.md`

- [ ] **Step 1: 写旧路由兼容检查**

断言旧 `#/content/journal`、`#/content/event`、`#/content/decision` 在独立站分别跳转到 `#/journal`、`#/event`、`#/decision`，主站无 VC 内容数据时不显示三个 VC 内容入口。

- [ ] **Step 2: 移除旧内容板可见入口**

导航和首页改为三个独立入口；旧 `content` 渲染器只保留兼容路由所需的重定向，不再作为独立板块展示。

- [ ] **Step 3: 运行完整验证**

运行：

```powershell
node scripts/build_victorian_century_site.mjs --source site --target "Victorian Century Database" --publish-target site/vc --vc-database database/victorian_century --skip-vc-assets
node scripts/check_victorian_century_content_contract.mjs
node scripts/check_victorian_century_content_change_contract.mjs
node scripts/check_victorian_century_standalone_site.mjs
node scripts/check_victorian_century_main_entry.mjs
node scripts/check_victorian_century_journal_browser.mjs
node scripts/check_victorian_century_content_browser.mjs
node scripts/check_victorian_century_decision_browser.mjs
node scripts/check_event_board_browser.mjs
node scripts/check_victorian_century_browser.mjs http://127.0.0.1:8877/index.html building goods
git diff --check
```

- [ ] **Step 4: 更新工作记录**

在 `docs/worklog/2026-08-15-victorian-century-content-merge.md` 追加三个板块、合并事件和 VC 标签的结果，并在根目录 `WORKLOG.md` 更新当前状态。
