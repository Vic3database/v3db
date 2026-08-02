# 成就搜索显式提交 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让成就搜索只在点击“搜索”或按回车后更新结果。

**Architecture:** `site/app/achievements.js` 在搜索表单中提供显式提交按钮，按钮点击和普通回车复用 `submitAchievementSearch()`。`site/styles/achievements.css` 让按钮与输入框高度一致；浏览器回归验证输入阶段不刷新、点击后才筛选。

**Tech Stack:** 原生 HTML、CSS、JavaScript、Node.js 浏览器回归脚本。

---

### Task 1: 显式提交搜索

**Files:**

- Create: `docs/superpowers/specs/2026-07-30-achievement-search-submit-design.md`
- Modify: `site/app/achievements.js`
- Modify: `site/styles/achievements.css`
- Modify: `scripts/check_achievement_board_contract.mjs`
- Modify: `scripts/check_achievement_board_browser.mjs`

- [x] **Step 1: 写入失败断言**

静态检查要求搜索表单、`data-achievement-search-submit` 和共享提交函数；浏览器检查在输入后要求结果仍为 141 项，再点击搜索按钮并等待单项结果。

- [x] **Step 2: 运行断言并确认失败**

运行：`node scripts/check_achievement_board_contract.mjs`

预期：因缺少显式搜索按钮而失败。

- [x] **Step 3: 实现最小提交逻辑**

将搜索框放入表单，添加 `type="submit"` 的“搜索”按钮。`submitAchievementSearch()` 读取输入值、更新 `state.achievementSearch`、清除空搜索的保存滚动位置、重渲染并恢复光标。普通回车和按钮点击调用该函数，输入法确认回车不提交。

- [x] **Step 4: 运行静态与浏览器回归检查**

运行：`node scripts/check_achievement_board_contract.mjs` 与 `node scripts/check_achievement_board_browser.mjs`

预期：两个脚本均以状态码 0 退出。

- [x] **Step 5: 提交**

运行：`git add docs/superpowers/specs/2026-07-30-achievement-search-submit-design.md docs/superpowers/plans/2026-07-30-achievement-search-submit.md site/app/achievements.js site/styles/achievements.css scripts/check_achievement_board_contract.mjs scripts/check_achievement_board_browser.mjs && git commit -m "fix: submit achievement search explicitly"`

预期：创建只包含成就搜索提交交互的提交。
