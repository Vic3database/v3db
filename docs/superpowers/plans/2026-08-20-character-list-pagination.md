# Historical Character List Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将史实角色列表限制为每页最多 100 人，并让分页作用于筛选、搜索和排序后的结果，同时在详情返回时保留当前页。

**Architecture:** 在角色板块状态中保存 `characterPage`，先生成完整的筛选排序结果，再按 `CHARACTER_PAGE_SIZE` 切片。分页控件由角色板块渲染到列表顶部和底部，使用事件委托修改页码；来源、性别筛选、搜索和排序发生变化时统一回到第一页，角色详情路由切换不清除页码。

**Tech Stack:** 现有原生 JavaScript、静态 HTML/CSS、中文/英文本地化字典、Node.js 契约测试和无头 Chrome 浏览器测试。

---

### Task 1: 建立分页契约与状态边界

**Files:**
- Modify: `site/app/runtime.js:135-214`，增加 `characterPage: 1`。
- Modify: `site/app/characters.js:1-190`，声明每页上限和分页渲染接口。
- Modify: `scripts/check_character_board_contract.mjs`，检查每页上限、过滤后切片、状态和分页控件契约。
- Modify: `scripts/check_character_board_browser.mjs`，检查首屏 100 行、翻页、筛选重置和详情返回。

- [x] **Step 1: 写出会失败的契约断言**，要求角色代码包含 `CHARACTER_PAGE_SIZE = 100`、`state.characterPage`、`filtered.slice(...)` 和分页按钮数据属性。
- [x] **Step 2: 运行契约测试确认失败**：`node scripts/check_character_board_contract.mjs`；预期因缺少分页实现而失败。

### Task 2: 实现角色列表分页

**Files:**
- Modify: `site/app/runtime.js:135-214`，初始化角色页码。
- Modify: `site/app/characters.js:114-190`，增加页码边界修正、分页控件渲染和点击处理；保留既有详情路由行为。
- Modify: `site/app/ui.js:374-378,420-440`，角色排序和全局清除筛选时将 `state.characterPage` 设为 1。
- Modify: `site/app/data.js:365-395`，数据清除路径同步重置角色页码。

- [x] **Step 1: 以失败契约为约束，实现过滤排序后分页**：总数仍显示完整结果数；空结果不渲染分页；页码超出范围时回到最后一页。
- [x] **Step 2: 绑定上下页和页码按钮**：点击后只更新 `state.characterPage` 并重新渲染，翻页不改 hash。
- [x] **Step 3: 让来源/性别筛选、搜索和排序回到第 1 页**，角色详情返回保留当前页。

### Task 3: 补充本地化与样式

**Files:**
- Modify: `site/locales/ui.zh-Hans.js:615-651`，增加分页说明、上一页、下一页和页码文案。
- Modify: `site/locales/ui.en.js:615-651`，增加对应英文文案。
- Modify: `site/styles/characters.css:1-240`，增加上下分页控件、禁用态和窄屏布局；不改变角色板块三栏结构。

- [x] **Step 1: 使用现有 `t()` 插值渲染“第 X / Y 页”和结果范围**，中英文键名保持一致。
- [x] **Step 2: 为分页控件设置可读的 `aria-label`、`aria-current` 和禁用态，窄屏下允许换行且不产生横向溢出。

### Task 4: 验证与提交

**Files:**
- Modify: `docs/worklog/2026-08-20-character-list-pagination.md`，记录实现、测试和提交信息。

- [x] **Step 1: 运行 `node scripts/check_character_board_contract.mjs`。**
- [x] **Step 2: 运行 `node scripts/check_character_board_browser.mjs`，仅使用无头浏览器，不打开视觉界面。**
- [x] **Step 3: 检查 `git diff --check` 和 `git status --short`，确认只包含角色分页相关文件。
- [ ] **Step 4: 提交独立工作树：`git add ...; git commit -m "feat: paginate historical character list"`。
