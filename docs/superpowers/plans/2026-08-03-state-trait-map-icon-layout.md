# 地区特质图标单行放大实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将地区特质视图的地图图标改为固定单行 30 像素排列，并将悬浮提示图标同步调整为 30 像素。

**Architecture:** 保留现有画布图标层、地域中心缓存和提示框结构，只修改 `drawStateTraitMapIcons` 的尺寸与横向偏移计算，以及 `map.css` 的提示图标尺寸。静态测试锁定布局公式，浏览器测试读取画布绘制参数和提示图标实际尺寸。

**Tech Stack:** 原生 JavaScript、Canvas 2D、CSS、Node.js 静态检查、Playwright 浏览器回归。

---

### Task 1: 写入失败的布局与尺寸回归条件

**Files:**
- Modify: `scripts/check_state_trait_map.mjs`
- Modify: `scripts/check_state_trait_map_browser.mjs`

- [x] **Step 1: 静态测试要求 `iconSize = 30`，不再计算行数和列数，并用数组索引计算单行横向偏移。**
- [x] **Step 2: 浏览器测试检查 `.map-tooltip-trait-icon` 的实际宽高均为 30 像素。**
- [x] **Step 3: 运行 `node scripts/check_state_trait_map.mjs`，确认旧实现因 22 像素和网格排列而失败。**

### Task 2: 实现单行 30 像素布局

**Files:**
- Modify: `site/app/map.js`
- Modify: `site/styles/map.css`
- Modify: `site/index.html`
- Modify: `site/styles.css`

- [x] **Step 1: 将 `drawStateTraitMapIcons` 的图标尺寸改为 30，并用 `(index - (traitCount - 1) / 2) * mapIconSize` 计算横向偏移，纵向偏移固定为 0。**
- [x] **Step 2: 将 `.map-tooltip-trait-icon` 的宽、高改为 30 像素。**
- [x] **Step 3: 将地图脚本和样式缓存版本更新为 `20260803-state-trait-map2`。**
- [x] **Step 4: 运行静态测试、地图相关回归和语法检查，确认全部通过。**

### Task 3: 浏览器验证与提交

**Files:**
- Modify: `docs/worklog/2026-08-03-state-trait-map.md`

- [x] **Step 1: 重建本地预览所需的前端副本。**
- [x] **Step 2: 运行 `scripts/check_state_trait_map_browser.mjs`，确认主站、Victorian Century 和 390 像素视口通过。**
- [x] **Step 3: 在工作记录中补充单行与 30 像素修订及验证结果。**
- [x] **Step 4: 执行 `git diff --check`，检查提交范围并提交。**
