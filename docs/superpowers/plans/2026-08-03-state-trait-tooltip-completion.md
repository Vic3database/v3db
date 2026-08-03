# 地区特质地图尺寸与悬停内容 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将地图地区特质图标调整为 32 像素，并让所有现有“地区特质”地图提示逐项显示 30 像素图标、名称和全部效果。

**Architecture:** 继续由 `mapTooltipStateTraitHtml` 负责地区特质列表的唯一 HTML 输出，地区特质筛选视图、普通地域地图和公司地图共享该函数。地图画布尺寸只修改 `drawStateTraitMapIcons` 的屏幕像素常量；提示尺寸由地图样式独立控制。

**Tech Stack:** 原生 JavaScript、Canvas 2D、CSS、Node.js 静态检查、Playwright 浏览器回归。

---

### Task 1: 固定尺寸和完整提示的回归契约

**Files:**
- Modify: `scripts/check_state_trait_map.mjs`
- Modify: `scripts/check_state_trait_map_browser.mjs`

- [ ] **Step 1: 将静态检查改为新尺寸并覆盖普通提示分支**

在 `scripts/check_state_trait_map.mjs` 中把地图尺寸断言改为：

```js
assert.ok(/const iconSize = 32;/.test(drawStateTraitMapIconsSource), "map trait icons should use 32 pixels");
assert.ok(/\.map-tooltip-trait-icon\s*\{[\s\S]*width:\s*30px;[\s\S]*height:\s*30px;/.test(readText("site/styles/map.css")), "tooltip icons should use 30 pixels");
```

再取得 `mapTooltipRowsForView` 的函数源码，断言地区特质筛选分支、公司分支和默认地域分支都调用 `mapTooltipStateTraitHtml`，并断言默认分支不再调用 `mapTooltipTraitSummary`。

- [ ] **Step 2: 将浏览器检查改为 32 像素地图和 30 像素提示**

把 `scripts/check_state_trait_map_browser.mjs` 中地图图标宽度、横向间距和窄屏宽度的期望值改为 32；把主站与 Victorian Century 提示图标边界框的期望值改为 30×30。

- [ ] **Step 3: 新增普通地域地图提示的浏览器断言**

在主站完成地区特质筛选视图检查后取消最后一个筛选，使 `state.mapMode` 返回普通地域模式；对同一个多特质地域触发 `pointermove`，断言：

```js
assert.equal(
  await main.locator("#mapTooltip .map-tooltip-trait").count(),
  target.traitCount,
  "ordinary region tooltip must list every trait",
);
assert.match(await main.locator("#mapTooltip").innerText(), new RegExp(escapeRegExp(target.effect)));
```

- [ ] **Step 4: 运行检查并确认红灯**

Run: `node scripts/check_state_trait_map.mjs`

Expected: FAIL，报告地图仍为 38 像素、提示仍为 38 像素，且普通地域分支仍使用摘要。

### Task 2: 共享完整地区特质提示

**Files:**
- Modify: `site/app/map.js`
- Modify: `site/styles/map.css`

- [ ] **Step 1: 修改地图和提示图标尺寸**

在 `drawStateTraitMapIcons` 中使用：

```js
const iconSize = 32;
```

在 `.map-tooltip-trait-icon` 中使用：

```css
width: 30px;
height: 30px;
```

- [ ] **Step 2: 让三种包含地区特质字段的提示共享完整列表**

在 `mapTooltipRowsForView` 内保留地区特质筛选视图现有调用，并把公司分支和默认地域分支的字段值替换为：

```js
["地区特质", tooltipHtml(mapTooltipStateTraitHtml(stateRegion.traits || []))],
```

保留 `compactTooltipRows` 的空值处理。`mapTooltipStateTraitHtml` 继续遍历完整数组，不切片、不汇总，每项输出图标、名称和 `stateTraitEffectText` 返回的完整效果文本。

- [ ] **Step 3: 运行静态检查并确认通过**

Run: `node scripts/check_state_trait_map.mjs`

Expected: PASS，并输出 `state_trait_map: "ok"`。

- [ ] **Step 4: 检查语法与空白**

Run: `node --check site/app/map.js`

Expected: 无输出，退出码为 0。

Run: `git diff --check`

Expected: 无输出，退出码为 0。

### Task 3: 浏览器核验与记录

**Files:**
- Modify: `docs/worklog/2026-08-03-state-trait-map.md`

- [ ] **Step 1: 运行地区特质浏览器回归**

Run: `node scripts/check_state_trait_map_browser.mjs`

Expected: PASS；主站、Victorian Century 和 390×844 视口均通过。输出应显示地图图标宽度与间距为 32，提示图标为 30×30，普通地域提示数量等于当地特质数量。

- [ ] **Step 2: 浏览器人工复核普通地域提示**

打开 `http://127.0.0.1:8894/index.html#/region`，确认未选择地区特质筛选时，将指针移到带多个特质的地域，可逐项看到图标、名称和全部效果；长内容仍位于现有可滚动提示框内。

- [ ] **Step 3: 更新工作记录**

在 `docs/worklog/2026-08-03-state-trait-map.md` 追加“尺寸与普通地图提示补全”，记录 32 像素地图图标、30 像素提示图标、共享完整列表，以及实际执行的静态与浏览器检查结果。

- [ ] **Step 4: 提交实现**

```bash
git add docs/superpowers/specs/2026-08-02-state-trait-map-design.md \
  docs/superpowers/plans/2026-08-03-state-trait-tooltip-completion.md \
  scripts/check_state_trait_map.mjs \
  scripts/check_state_trait_map_browser.mjs \
  site/app/map.js \
  site/styles/map.css \
  docs/worklog/2026-08-03-state-trait-map.md
git commit -m "feat: complete state trait map tooltips"
```
