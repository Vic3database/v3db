# 角色与姓名池板块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 Vicdata 1.13.9 版本站点中新增史实角色与独立文化姓名池板块，保留现有三栏布局和肖像跳过范围。

**Architecture:** 先由独立构建脚本把已生成的历史角色、文化姓名池报告拆成两个版本数据块，再由现有数据加载器按角色或姓名池路由加载。前端新增一个角色板块渲染文件和一个姓名池板块渲染文件，复用现有本地化、筛选、详情和概念标签工具。

**Tech Stack:** 原生 JavaScript、现有 HTML/CSS、Node.js 构建脚本、Playwright 浏览器契约检查。

---

### Task 1: 建立板块契约测试

**Files:**
- Create: `scripts/check_character_board_contract.mjs`

- [ ] **Step 1: Write the failing test**

检查 `site/index.html`、`site/app/*.js`、`site/styles/characters.css` 和 `site/versions/1.13.9/data-index.js` 中的角色导航、姓名池导航、路由、数据块、两个独立渲染函数、筛选属性及移动端样式；当前仓库没有这些实现，断言应失败。

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/check_character_board_contract.mjs`

Expected: FAIL，明确指出角色数据块或导航入口缺失。

### Task 2: 构建角色与姓名池数据块

**Files:**
- Create: `scripts/build_character_board_data.mjs`
- Modify: `scripts/build_wiki.mjs`
- Test: `scripts/check_character_board_contract.mjs`

- [ ] **Step 1: Implement report loading**

脚本读取 `output/historical-characters/historical-characters.json` 和 `output/culture-names/culture-names.json`，在报告缺失、分支不一致或角色/文化数量不匹配时抛出错误。输出两个版本数据文件：

```js
window.VIC3_DATA_CHUNK = {
  historicalCharacters: report.characters,
  historicalCharacterStats: report.stats,
};
```

以及：

```js
window.VIC3_DATA_CHUNK = {
  namePools: report.cultures,
  namePoolStats: report.stats,
};
```

- [ ] **Step 2: Add chunk descriptors**

在 `scripts/build_wiki.mjs` 的 `wikiData`、`dataChunks`、文件名映射和输出统计中加入 `historicalCharacters`、`historicalCharacterStats`、`namePools`、`namePoolStats`；角色与姓名池数据使用独立 chunk，不混入文化基础 chunk。

- [ ] **Step 3: Generate version files**

Run: `node scripts/build_character_board_data.mjs --version-dir site/versions/1.13.9 --historical-report output/historical-characters/historical-characters.json --name-pool-report output/culture-names/culture-names.json`

Expected: 生成 `data-characters.js`、`data-name-pools.js` 和中英文空本地化结构块，并更新 `data-index.js`。

### Task 3: 接入运行时数据与导航路由

**Files:**
- Modify: `site/index.html`
- Modify: `site/app/runtime.js`
- Modify: `site/app/data.js`
- Modify: `site/app/ui.js`
- Modify: `site/app/i18n.js`

- [ ] **Step 1: Add navigation and view state**

在社会菜单加入 `character` 与 `name-pool` 按钮，隐藏的板块选择器加入两个选项；运行时增加 `historicalCharacters`、`historicalCharacterStats`、`namePools`、`namePoolStats` 和对应索引；`routeView()`、`dataChunksForView()`、`detailRouteKey()` 支持 `character` 与 `name-pool`。

- [ ] **Step 2: Add view dispatch**

在 `render()` 分派 `renderCharacterBoard()` 与 `renderNamePoolBoard()`，在 `setView()` 和 `updatePageChrome()` 中保留两个板块的标题、导航高亮与路由状态；切换数据集时清空新增选中键和筛选集合。

- [ ] **Step 3: Add route-loading localization**

角色路由加载 `character` chunk 与文化、意识形态、法律、宗教所需本地化；姓名池路由加载 `name-pool` chunk 与文化本地化；英文切换重新加载对应 chunk。

### Task 4: 实现角色板块

**Files:**
- Create: `site/app/characters.js`
- Modify: `site/app/filters.js`
- Modify: `site/app/components.js`

- [ ] **Step 1: Add filter predicates**

实现 `matchesHistoricalCharacterFilters()`，按搜索文本、`in_starting_history`、`has_dna`、`female` 和角色文化筛选；角色搜索覆盖中文名、英文名、模板键、文化键和文化显示名。

- [ ] **Step 2: Render list and detail**

实现最多 220 条的角色列表、键盘选择、详情路由和详情字段。文化使用现有文化概念链接，利益集团、意识形态和特质复用已有标签组件；DNA 仅显示键和定义状态。

- [ ] **Step 3: Bind interactions**

绑定角色筛选按钮、角色列表选择、详情返回、全局搜索结果进入角色详情；姓名池不在角色详情中渲染。

### Task 5: 实现独立姓名池板块

**Files:**
- Create: `site/app/name-pools.js`

- [ ] **Step 1: Add culture filter and list**

实现文化姓名池搜索、文化列表、选择状态和 `#/name-pool/<culture-key>` 详情路由；显示文化键、传承、语言、姓名池总数和史实角色数量。

- [ ] **Step 2: Render nine name pools**

按数据块中的九个固定池键逐组显示条目数量、原始键和本地化文本，空池明确显示空；不展开组合姓名。

### Task 6: 样式与本地化

**Files:**
- Create: `site/styles/characters.css`
- Modify: `site/index.html`
- Modify: `site/locales/ui.zh-Hans.js`
- Modify: `site/locales/ui.en.js`

- [ ] **Step 1: Add responsive styles**

为角色和姓名池列表、详情、筛选和姓名池分组增加样式；桌面保持三栏，窄屏改为列表优先并在详情路由显示详情，390px 下不出现横向滚动。

- [ ] **Step 2: Add bilingual messages**

新增导航、板块标题、筛选、角色字段、姓名池字段和空状态的中英文消息，所有新增可见文本使用 `t()`。

### Task 7: 验证、提交与浏览器检查

**Files:**
- Create: `scripts/check_character_board_browser.mjs`

- [ ] **Step 1: Run static checks**

Run: `node scripts/check_historical_characters.mjs; node scripts/check_culture_names.mjs; node scripts/check_character_board_contract.mjs; git diff --check`

Expected: 三个检查器通过，差异无空白错误。

- [ ] **Step 2: Run browser checks**

Run: `node scripts/check_character_board_browser.mjs --url http://127.0.0.1:4173/index.html`

Expected: 角色板块、角色详情、姓名池板块、姓名池详情在中文和英文下均有内容，390px 页面横向溢出为 0。

- [ ] **Step 3: Commit**

```powershell
git add scripts/build_character_board_data.mjs scripts/check_character_board_contract.mjs scripts/check_character_board_browser.mjs scripts/build_wiki.mjs site/index.html site/app site/styles/characters.css site/locales
git commit -m "feat: add historical character boards"
```
