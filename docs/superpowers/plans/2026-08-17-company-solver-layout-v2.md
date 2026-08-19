# 公司组合求解器界面调整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将公司组合求解器调整为无左栏、列表与详情 6:4 分栏、五类紧凑图标选择，并按公司数逐级尝试结果。

**Architecture:** 保留现有公司求解核心和 Worker 接口，在请求参数中加入 `companyCount`，由界面按 1、2、3…逐级请求直到得到结果。求解器页面独占完整内容区，使用现有列表与详情容器，通过 CSS 将两栏设置为 6:4；建筑目录在运行时合并为五组展示。

**Tech Stack:** 原生 JavaScript、CSS、Node.js 契约测试、Chrome 调试协议浏览器测试。

---

### Task 1: 增加公司数量状态和求解上限测试

**Files:**
- Modify: `site/app/runtime.js`
- Modify: `site/app/company-solver.js`
- Modify: `site/app/company-solver-worker.js`
- Modify: `site/app/company-solver-core.mjs`
- Test: `scripts/check_company_solver_core.mjs`
- Test: `scripts/check_company_solver_worker.mjs`

- [ ] **Step 1: Write the failing tests**

在核心测试中加入：目标有解时 `solveCompanyCombinations(model, { companyCount: 1 })` 只返回 1 家公司；无 1 家公司解时 `companyCount: 2` 返回 2 家公司解。Worker 测试检查 `run` 消息可以携带 `companyCount`，并检查结果只包含该数量的公司。

- [ ] **Step 2: Run tests to verify they fail**

运行 `node scripts/check_company_solver_core.mjs; node scripts/check_company_solver_worker.mjs`，预期新断言失败，因为核心当前没有 `companyCount` 限制。

- [ ] **Step 3: Implement the minimum solver constraint**

在 `solveCompanyCombinations` 中读取 `options.companyCount`，DFS 到达目标时仅接受 `selectedRows.length === companyCount`，并在搜索中剪枝：已选公司数达到上限且未覆盖全部目标时返回。Worker 将 `message.companyCount` 传入核心，并在完成消息中回传 `companyCount`。运行状态新增 `companyCount: 1`、`autoCompanyCount: true`、`progress` 字段。

- [ ] **Step 4: Run tests to verify they pass**

再次运行两个测试，预期全部通过，并保留原有互斥选择组测试。

### Task 2: 实现公司数逐级尝试

**Files:**
- Modify: `site/app/company-solver.js`
- Modify: `site/app/company-solver-async-fallback.js`
- Modify: `site/app/company-solver-worker.js`
- Modify: `site/app/runtime.js`
- Test: `scripts/check_company_solver_browser.mjs`

- [ ] **Step 1: Write the failing browser assertions**

浏览器测试选择煤、铁、钢、工具，断言执行后显示公司数为 1 或 2，并且每张方案卡片的公司数量等于当前显示数量；加入“公司数”选择控件存在且默认值为 1 的断言。

- [ ] **Step 2: Run the browser test to verify it fails**

运行 `node scripts/check_company_solver_browser.mjs`，预期找不到公司数控件或方案仍返回任意数量。

- [ ] **Step 3: Implement automatic fallback**

执行时从 `companyCount = 1` 开始。Worker 或备用求解完成后，如果结果为空且当前数量小于公司总数，则递增数量并重新计算；首次得到非空结果后停止。用户手动选择数量时关闭自动递增，只请求指定数量。进度文字同时显示当前公司数。

- [ ] **Step 4: Run browser tests**

运行浏览器测试，预期普通组合、重型组合、服务器模式和 `file://` 模式均能在有限公司数下返回结果。

### Task 3: 重排求解器页面为 6:4 双栏并移除左栏

**Files:**
- Modify: `site/app/boards.js`
- Modify: `site/app/runtime.js`
- Modify: `site/styles/records.css`
- Modify: `site/styles/shell.css`
- Test: `scripts/check_company_solver_contract.mjs`
- Test: `scripts/check_company_solver_browser.mjs`

- [ ] **Step 1: Write failing layout assertions**

契约测试检查求解器页面使用独立的 `company-solver-layout` 容器。浏览器测试检查左侧筛选面板在求解器页面隐藏，方案列表和详情同级显示，计算出的宽度比例在 1.4 至 1.7 之间。

- [ ] **Step 2: Verify failure**

运行契约和浏览器测试，预期当前三栏结构导致断言失败。

- [ ] **Step 3: Implement layout**

在求解器渲染中将列表和详情放进 `.company-solver-layout`，桌面使用 `grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr)`；求解器状态下给左筛选栏添加隐藏类。窄屏媒体查询改为单列。

- [ ] **Step 4: Verify layout**

运行浏览器测试，确认桌面为 6:4，窄屏不横向溢出，详情箭头仍能打开详情。

### Task 4: 五类建筑图标和统一视觉样式

**Files:**
- Modify: `site/app/runtime.js`
- Modify: `site/app/company-solver.js`
- Modify: `site/styles/records.css`
- Modify: `site/locales/ui.zh-Hans.js`
- Modify: `site/locales/ui.en.js`
- Test: `scripts/check_company_solver_contract.mjs`
- Test: `scripts/check_company_solver_browser.mjs`

- [ ] **Step 1: Write failing grouping/style assertions**

检查五组数量为 `[10, 16, 7, 10, 5]`，图标尺寸大于当前值，选中按钮使用记录板块的 selected 样式，且旧七组分类容器不再出现。

- [ ] **Step 2: Verify failure**

运行契约和浏览器测试，预期当前七组目录和旧样式导致失败。

- [ ] **Step 3: Implement grouping and styles**

在运行时目录中定义五个大组；渲染时输出无额外卡片的紧凑图标网格，使用现有建筑选择按钮的边框、背景和 `aria-pressed` 状态样式。统一工具栏、分页、方案卡片和详情面板的背景、边框、圆角和强调色。

- [ ] **Step 4: Run all feature tests**

运行核心、Worker、契约、浏览器和发布包检查，确认五组目录、卡片箭头、详情链接和多语言文本均正常。

### Task 5: 更新工作记录并完成验证

**Files:**
- Modify: `docs/worklog/2026-08-17-company-industry-combination-solver.md`

- [ ] **Step 1: Record the final behavior**

记录 6:4 布局、五组图标数量、公司数逐级尝试规则、本地备用求解器和验证命令。

- [ ] **Step 2: Run final checks**

运行：

```text
node scripts/check_company_solver_core.mjs
node scripts/check_company_solver_worker.mjs
node scripts/check_company_solver_contract.mjs
node scripts/check_company_solver_browser.mjs
node scripts/check_publish_bundle.mjs
```

预期所有检查通过，浏览器报告桌面和窄屏均无横向溢出，重型组合不会显示无限数量结果。
