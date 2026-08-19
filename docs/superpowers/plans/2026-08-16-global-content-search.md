# 日志、事件与决议全局搜索实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让原版 1.13.10、主站 VC 和独立 VC 的全局搜索命中日志、事件与决议，并提供可选的详细字段搜索。

**Architecture:** 静态 `search-index.js` 只保存三类内容的标题、ID 和组信息。前端首次开启详细搜索时，从已加载内容数据生成详细字段缓存；搜索结果通过现有详情路由跳转。内容构建脚本共享一个索引更新模块，避免原版和 VC 产生不同格式。

**Tech Stack:** Node.js ESM 构建与合同测试、原生浏览器 JavaScript、Chrome DevTools Protocol 浏览器测试、静态 HTML/CSS。

---

### Task 1: 建立失败的静态合同

**Files:**
- Create: `scripts/check_global_content_search.mjs`
- Inspect: `site/versions/1.13.10/search-index.js`
- Inspect: `site/vc/search-index.js`
- Inspect: `Victorian Century Database/search-index.js`

- [ ] **Step 1: 写入索引和界面合同**

合同读取三个输出的 `data-content.js` 与 `search-index.js`，断言 `journal`、`event`、`decision` 索引数量分别等于内容数量；抽查 `je_abolish_monarchy`、`1848.1` 和 `revive_olympic_games_decision` 的双语标题、`groupKey`、`groupNames`。同时断言静态索引不含 `raw`、说明和选项字段，并检查详细搜索开关、缓存函数、三类导航和中英文文案。

- [ ] **Step 2: 运行合同并确认按预期失败**

Run: `node scripts/check_global_content_search.mjs`

Expected: FAIL，首个错误指出原版搜索索引没有 `journal` 条目。

### Task 2: 建立失败的浏览器合同

**Files:**
- Create: `scripts/check_global_content_search_browser.mjs`

- [ ] **Step 1: 写入原版与独立 VC 浏览器场景**

测试自行启动静态服务器和无头 Chrome。默认模式分别以标题、ID 和组名查找三类结果，并点击结果核对 `#/journal/<ID>`、`#/event/<ID>`、`#/decision/<ID>`。随后以只存在于日志脚本中的 `abolishing_monarchy_var` 查询：关闭开关时结果为零，开启后出现日志结果和匹配摘录。

- [ ] **Step 2: 运行浏览器合同并确认按预期失败**

Run: `node scripts/check_global_content_search_browser.mjs`

Expected: FAIL，错误指出页面缺少 `#globalSearchDetailedToggle` 或三类默认搜索结果。

### Task 3: 生成三类轻量搜索条目

**Files:**
- Create: `scripts/content_search_index.mjs`
- Modify: `scripts/build_vanilla_content_site_data.mjs`
- Modify: `scripts/build_victorian_century_content_site_data.mjs`

- [ ] **Step 1: 实现共享索引更新模块**

模块导出 `updateContentSearchIndex({ site, content })`。它读取现有 `search-index.js`，移除旧的 `journal`、`event`、`decision` 条目，再按以下结构追加新条目并原子重写文件：

```js
{
  kind: "event",
  id: "event:1848.1",
  key: "1848.1",
  groupKey: "1848",
  names: { "zh-Hans": "审判……", en: "The Trial of ..." },
  groupNames: { "zh-Hans": "人民之春", en: "Springtime of the Peoples" }
}
```

日志从 `locales.zhHans.name`、`locales.en.name` 和日志组记录取名；事件使用 `locales.*.title` 与 `group_locales`；决议使用 `locales.*.name` 与 `group_locales`。字段缺失时回退到 ID 或组 ID。

- [ ] **Step 2: 在两个内容构建器写完 `data-content.js` 后更新索引**

两个构建器调用共享模块，并在输出摘要中加入三类搜索条目数量。不得把说明、选项、来源路径或原始脚本写进静态搜索索引。

- [ ] **Step 3: 重建三个输出**

Run:

```powershell
node scripts/build_vanilla_content_site_data.mjs --version 1.13.10 --database database/vic3_1.13.10 --site site/versions/1.13.10
node scripts/build_victorian_century_content_site_data.mjs --database database/victorian_century --site site/vc
node scripts/build_victorian_century_content_site_data.mjs --database database/victorian_century --site "Victorian Century Database"
```

Expected: 原版报告 418/2239/60，两个 VC 输出均报告 857/2946/102。

### Task 4: 实现详细搜索状态、缓存和结果呈现

**Files:**
- Modify: `site/index.html`
- Modify: `site/app/runtime.js`
- Modify: `site/app/data.js`
- Modify: `site/app/ui.js`
- Modify: `site/app/boards.js`
- Modify: `site/locales/ui.zh-Hans.js`
- Modify: `site/locales/ui.en.js`
- Modify: `site/styles/dialogs.css`

- [ ] **Step 1: 增加开关、状态和缓存生命周期**

HTML 在搜索框下增加 `#globalSearchDetailedToggle`。`state.globalSearchDetailed` 默认 `false`；`globalSearchDetailCache` 默认 `null`。切换开关时重绘结果，切换数据集时清空缓存，重新打开弹窗时同步控件状态。

- [ ] **Step 2: 建立详细字段缓存**

新增 `ensureGlobalSearchDetailCache()`，按 `journal:<ID>`、`event:<ID>`、`decision:<ID>` 保存可搜索片段。日志包含 reason、显示与完成条件、效果、来源路径和 raw；事件包含 desc、flavor、所有双语选项、trigger、immediate、来源路径和 raw；决议包含 desc、显示条件、执行条件、执行效果、AI 条件、来源路径和 raw。

- [ ] **Step 3: 扩展匹配、排序和摘录**

`globalSearchResults()` 把 `groupKey`、`groupNames` 加入默认 haystack。只有 `state.globalSearchDetailed` 为真时才查询详细缓存。详细字段命中得分低于全部默认字段命中，并通过 `globalSearchMatchExcerpt()` 生成命中位置附近的单行摘录。内容结果的副标题显示 `ID · 组名`，详细摘录另起一行并经过 HTML 转义。

- [ ] **Step 4: 增加三类导航和类型文案**

`navigateGlobalSearchResult()` 增加三条路由；中英文分别增加日志、事件、决议、详细搜索及说明文案。样式使两个开关共用布局，摘录使用次要文本样式并允许换行。

- [ ] **Step 5: 同步独立站点外壳**

运行现有 VC 站点构建流程，将主站 HTML、应用脚本、语言文件和样式同步到 `site/vc` 与 `Victorian Century Database`，再重新运行两个 VC 内容构建器以更新内容搜索索引。

### Task 5: 通过合同与浏览器验证

**Files:**
- Test: `scripts/check_global_content_search.mjs`
- Test: `scripts/check_global_content_search_browser.mjs`
- Test: `scripts/check_global_search.mjs`
- Test: `scripts/check_data_chunking.mjs`
- Test: `scripts/check_victorian_century_standalone_site.mjs`

- [ ] **Step 1: 运行新增静态合同**

Run: `node scripts/check_global_content_search.mjs`

Expected: PASS，并输出三个站点的三类索引数量。

- [ ] **Step 2: 运行现有相关回归合同**

Run:

```powershell
node scripts/check_global_search.mjs
node scripts/check_data_chunking.mjs
node scripts/check_victorian_century_standalone_site.mjs
```

Expected: 三条命令均以状态码 0 结束。

- [ ] **Step 3: 运行浏览器合同**

Run: `node scripts/check_global_content_search_browser.mjs`

Expected: PASS，报告原版和独立 VC 的默认搜索、详细搜索、摘录与三类跳转均通过。

- [ ] **Step 4: 核对差异范围**

Run: `git diff --check`，并用 `git status --short` 核对本功能文件。当前工作区存在与内容板块相关的既有暂存和未暂存修改，实施期间不创建代码提交，避免把同一文件中的既有改动一并提交。
