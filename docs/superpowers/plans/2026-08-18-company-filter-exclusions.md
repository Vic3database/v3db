# 公司板块建筑筛选排除项 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让公司板块筛选栏隐藏金矿场和自给建筑，同时保留金矿并保持地区板块原有筛选行为。

**Architecture:** 在 `visibleResourceFilterGroups()` 为公司视图创建过滤后的筛选组副本，仅移除 `building_gold_field` 和 `subsistence_buildings`。原始 `resourceFilterGroups` 不修改，因此地区筛选、地图模式和其他板块继续使用完整目录。公司板块浏览器检查验证排除项、保留项及地区范围。

**Tech Stack:** 原生 JavaScript、Node.js 静态契约检查、Chrome DevTools 浏览器检查。

---

### Task 1: 为公司筛选栏写失败回归检查

**Files:**
- Modify: `scripts/check_company_composer_browser.mjs`

- [ ] **Step 1: 在公司组合器页面加入筛选项断言**

在进入公司组合器并确认公司卡片出现后，读取 `[data-resource-filter]` 的键，加入以下断言：

```js
const companyFilterKeys = await page.evaluate(() => Array.from(document.querySelectorAll("[data-resource-filter]"), (node) => node.dataset.resourceFilter));
assert.equal(companyFilterKeys.includes("building_gold_field"), false, "company filters must hide gold fields");
assert.equal(companyFilterKeys.includes("subsistence_buildings"), false, "company filters must hide subsistence buildings");
assert.equal(companyFilterKeys.includes("building_gold_mine"), true, "company filters must keep gold mines");
```

- [ ] **Step 2: 运行浏览器检查，确认当前实现按预期失败**

运行：

```text
node scripts/check_company_composer_browser.mjs
```

预期：检查在公司筛选项断言处失败，原因是当前公司视图仍包含 `building_gold_field` 或 `subsistence_buildings`。

### Task 2: 仅为公司视图过滤筛选组

**Files:**
- Modify: `site/app/filters.js:723-741`

- [ ] **Step 1: 在 `visibleResourceFilterGroups()` 中增加公司筛选排除逻辑**

将公司视图分支从直接返回原始数组改为返回分组副本：

```js
function visibleResourceFilterGroups() {
  if (state.view === "company") {
    const excludedKeys = new Set(["building_gold_field", "subsistence_buildings"]);
    return resourceFilterGroups
      .map((group) => ({ ...group, filters: (group.filters || []).filter((filter) => !excludedKeys.has(filter.key)) }))
      .filter((group) => group.filters.length);
  }
  const groups = resourceFilterGroups.filter((group) => !group.companyOnly);
  // existing non-company grouping logic remains unchanged
}
```

保留原函数其余非公司视图逻辑；不得从 `resourceFilterGroups` 原数组删除元素。这样 `syncSetWithOptions()` 会同步清理公司视图中已不存在的筛选状态。

- [ ] **Step 2: 运行公司组合器浏览器检查，确认筛选断言通过**

运行：

```text
node scripts/check_company_composer_browser.mjs
```

预期：输出 `company_composer_browser: ok`，桌面和窄屏公司视图均不出现两个排除项，金矿仍存在。

### Task 3: 验证普通公司页和地区板块没有被扩大影响

**Files:**
- Modify: `scripts/check_company_composer_contract.mjs`（仅在现有契约缺少版本或函数保护时补充断言）
- Test: `scripts/check_subsistence_building_map.mjs`
- Test: `scripts/check_subsistence_building_map_browser.mjs`
- Test: `scripts/check_company_composer_core.mjs`
- Test: `scripts/check_company_composer_contract.mjs`

- [ ] **Step 1: 运行静态与核心检查**

运行：

```text
node scripts/check_company_composer_core.mjs
node scripts/check_company_composer_contract.mjs
node scripts/check_subsistence_building_map.mjs
```

预期：三个命令均以退出码 0 完成。

- [ ] **Step 2: 运行地区自给建筑浏览器检查**

运行：

```text
node scripts/check_subsistence_building_map_browser.mjs
```

预期：输出 `subsistence_building_map_browser: ok`，地区板块仍能选择 `subsistence_buildings` 并显示地图图例。

- [ ] **Step 3: 运行语法和差异检查**

运行：

```text
node --check site/app/filters.js
git diff --check -- site/app/filters.js scripts/check_company_composer_browser.mjs scripts/check_company_composer_contract.mjs
```

预期：无语法错误、无空白错误。

- [ ] **Step 4: 提交本次实现文件**

只暂存本任务涉及的文件并提交：

```text
git add site/app/filters.js scripts/check_company_composer_browser.mjs scripts/check_company_composer_contract.mjs
git commit -m "fix: hide non-company buildings from company filters"
```

不得暂存工作区中其他既有修改或未跟踪文件。
