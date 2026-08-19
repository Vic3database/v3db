# 公司求解器使用率默认折叠实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让产业组合求解器的“公司使用率”在每轮求解完成后默认收起，用户展开后翻页保持展开，再次执行时恢复收起。

**Architecture:** 在现有 `state.companySolver` 中保存一个界面布尔值 `usageOpen`，统计区域改用原生 `details`。渲染后的 `toggle` 事件同步状态；新求解开始时单独清除该状态，分页请求不修改。共享前端完成后，通过现有构建脚本复制到 Victorian Century 独立版和 `site/vc`。

**Tech Stack:** 原生 JavaScript、HTML `details`/`summary`、CSS、Node.js 静态合同检查、Chrome DevTools Protocol 浏览器检查。

---

## 文件职责

- `site/app/runtime.js`：保存求解器的 `usageOpen` 界面状态。
- `site/app/company-solver.js`：重置、渲染并同步统计区域的展开状态。
- `site/styles/records.css`：保持统计区域既有外观，并为 `summary` 和展开内容设置间距。
- `site/index.html`、`site/styles.css`：更新公司求解器脚本和统计样式缓存标识。
- `scripts/check_company_solver_contract.mjs`：检查状态字段、原生折叠结构、事件同步和缓存标识。
- `scripts/check_company_solver_browser.mjs`：检查默认收起、展开、翻页保持以及重新执行后收起。
- `scripts/check_victorian_century_standalone_site.mjs`：检查两份 VC 输出加载新版共享脚本和样式。
- `scripts/check_victorian_century_company_tools_browser.mjs`：检查两份 VC 页面的公司使用率默认收起。
- `docs/worklog/2026-08-18-company-building-composer.md`、`WORKLOG.md`：记录本地实现、验证和发布状态。

### Task 1: 先写原版失败检查

**Files:**
- Modify: `scripts/check_company_solver_contract.mjs`
- Modify: `scripts/check_company_solver_browser.mjs`

- [ ] **Step 1: 在静态合同中声明新结构**

在 `scripts/check_company_solver_contract.mjs` 中增加以下检查，并把公司求解器脚本和共享样式缓存标识改为 `20260819-company-usage-collapse1`：

```js
assert.match(runtime, /usageOpen:\s*false/);
assert.match(solver, /<details class="company-solver-usage"/);
assert.match(solver, /data-company-solver-usage/);
assert.match(solver, /usageDetails\.addEventListener\("toggle"/);
assert.match(solver, /state\.companySolver\.usageOpen\s*=\s*usageDetails\.open/);
assert.match(index, /app\/company-solver\.js\?v=20260819-company-usage-collapse1/);
assert.match(index, /styles\.css\?v=20260819-company-usage-collapse1/);
assert.match(styleEntry, /styles\/records\.css\?v=20260819-company-usage-collapse1/);
assert.match(styles, /\.company-solver-usage summary/);
```

删除同一文件中对旧公司求解器脚本缓存标识的断言，后台线程缓存标识保持 `20260818-vc-company-tools1`，因为线程代码没有变化。

- [ ] **Step 2: 在浏览器检查中声明完整交互**

在 `scripts/check_company_solver_browser.mjs` 的最终求解结果检查中，用以下断言替换只检查统计项目存在的两行。测试使用当前能产生 35 个方案、2 页结果的建筑选择：

```js
assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-company-solver-usage]"))), true, "solver should show company usage statistics");
assert.equal(await page.evaluate(() => document.querySelector("[data-company-solver-usage]")?.open), false, "company usage should be collapsed after solving");
assert.equal(await page.evaluate(() => document.querySelector(".company-solver-usage-item")?.getClientRects().length || 0), 0, "collapsed company usage should hide its rows");

await page.click("[data-company-solver-usage] summary");
await page.waitFor(() => document.querySelector("[data-company-solver-usage]")?.open === true, "expanded company usage");
assert.ok(await page.evaluate(() => Array.from(document.querySelectorAll(".company-solver-usage-item")).every((node) => /%/.test(node.textContent) && node.getClientRects().length > 0)), "expanded company usage should show percentage rows");

await page.click("button[data-company-solver-page='next']:not(:disabled)");
await page.waitFor(() => state.companySolver.page === 2 && document.querySelector("[data-company-solver-usage]")?.open === true, "company usage stays open after pagination");

await page.click("[data-company-solver-run]");
assert.equal(await page.evaluate(() => state.companySolver.usageOpen), false, "starting a new solve should clear company usage expansion");
await page.waitFor(() => state.companySolver.status === "complete" && document.querySelectorAll(".company-solver-card").length > 0, "second solver result");
assert.equal(await page.evaluate(() => document.querySelector("[data-company-solver-usage]")?.open), false, "company usage should collapse again after a new solve");
```

- [ ] **Step 3: 运行检查并确认按预期失败**

Run:

```powershell
node scripts/check_company_solver_contract.mjs
node scripts/check_company_solver_browser.mjs
```

Expected: 静态合同因缺少 `usageOpen` 或新版缓存标识失败；浏览器检查因缺少 `[data-company-solver-usage]` 失败。失败原因必须来自尚未实现的折叠功能。

### Task 2: 实现原版折叠状态

**Files:**
- Modify: `site/app/runtime.js`
- Modify: `site/app/company-solver.js`
- Modify: `site/styles/records.css`
- Modify: `site/index.html`
- Modify: `site/styles.css`
- Modify: `scripts/check_company_composer_contract.mjs`
- Modify: `scripts/check_subsistence_building_map.mjs`

- [ ] **Step 1: 增加求解器界面状态**

在 `site/app/runtime.js` 的 `companySolver` 状态中紧接 `companyUsage` 增加：

```js
companyUsage: [],
usageOpen: false,
```

- [ ] **Step 2: 仅在新求解开始时重置状态**

在 `site/app/company-solver.js` 的 `runCompanySolver()` 中，于增加 `requestId` 后、调用 `companySolverResetResults("running")` 前增加：

```js
state.companySolver.usageOpen = false;
```

不要在 `companySolverResetResults()` 或 `companySolverInvalidate()` 中清除该字段。这样改变筛选条件时不会额外改变界面状态，点击执行时才恢复默认收起。

- [ ] **Step 3: 将统计区域改为 details**

把 `renderCompanySolverUsage()` 的返回结构改为：

```js
return rows
  ? '<details class="company-solver-usage" data-company-solver-usage' + (solver.usageOpen ? " open" : "") + '><summary>' + escapeHtml(solverT("board.company.solverUsageTitle", "公司使用率")) + '</summary><div class="company-solver-usage-list">' + rows + '</div></details>'
  : "";
```

统计项目生成和百分比算法不变。

- [ ] **Step 4: 在每次渲染后同步 toggle 状态**

在 `renderCompanySolverBoard()` 中，紧接现有名贵商品折叠栏监听代码后增加：

```js
const usageDetails = els.countryList.querySelector("[data-company-solver-usage]");
if (usageDetails) usageDetails.addEventListener("toggle", () => {
  state.companySolver.usageOpen = usageDetails.open;
});
```

分页收到后台线程响应后仍调用 `renderCompanySolverBoard()`；新节点根据 `usageOpen` 输出 `open`，因此无需修改分页消息和请求格式。

- [ ] **Step 5: 调整统计区域样式**

将 `site/styles/records.css` 中统计容器和标题样式改为：

```css
.company-solver-usage {
  border: 1px solid var(--line);
  background: var(--surface);
}

.company-solver-usage summary {
  padding: .75rem 1rem;
  color: var(--ink);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}

.company-solver-usage-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: .35rem .85rem;
  padding: 0 1rem .75rem;
}
```

删除旧的 `.company-solver-usage h3` 规则以及容器自身的 `display: grid`、`gap` 和 `padding`，防止关闭状态仍保留内容间距。

- [ ] **Step 6: 更新共享缓存标识及相应合同**

在 `site/index.html` 中把顶层 `styles.css` 和 `app/company-solver.js` 的查询标识改为 `20260819-company-usage-collapse1`。在 `site/styles.css` 中把 `styles/records.css` 的查询标识改为同一值。

同步修改以下既有断言：

```js
// scripts/check_company_composer_contract.mjs
assert.match(index, /styles\.css\?v=20260819-company-usage-collapse1/);
assert.match(styles, /styles\/records\.css\?v=20260819-company-usage-collapse1/);

// scripts/check_subsistence_building_map.mjs
assert.match(indexSource, /styles\.css\?v=20260819-company-usage-collapse1/, "main entry must invalidate the current shared styles");
```

- [ ] **Step 7: 运行原版检查并确认通过**

Run:

```powershell
node scripts/check_company_solver_contract.mjs
node scripts/check_company_solver_browser.mjs
node scripts/check_company_composer_contract.mjs
node scripts/check_subsistence_building_map.mjs
```

Expected: 四项检查退出码均为 0；桌面和 390 像素结果都验证默认收起、翻页保持展开、再次执行后收起，且无横向溢出。

### Task 3: 同步并验证 Victorian Century

**Files:**
- Modify: `scripts/check_victorian_century_standalone_site.mjs`
- Modify: `scripts/check_victorian_century_company_tools_browser.mjs`
- Generate: `Victorian Century Database/`
- Generate: `site/vc/`

- [ ] **Step 1: 更新 VC 静态合同并先观察失败**

把 `scripts/check_victorian_century_standalone_site.mjs` 中两份输出的公司求解器脚本断言改为：

```js
assert.match(html, /app\/company-solver\.js\?v=20260819-company-usage-collapse1/, "standalone VC page must load the collapsible company-usage release");
assert.match(publishedHtml, /app\/company-solver\.js\?v=20260819-company-usage-collapse1/, "published VC page must load the collapsible company-usage release");
```

再增加两份输出的顶层样式缓存断言：

```js
assert.match(html, /styles\.css\?v=20260819-company-usage-collapse1/);
assert.match(publishedHtml, /styles\.css\?v=20260819-company-usage-collapse1/);
```

Run:

```powershell
node scripts/check_victorian_century_standalone_site.mjs
```

Expected: FAIL，指出尚未重新生成的 VC 页面仍引用旧缓存标识。

- [ ] **Step 2: 给 VC 浏览器检查增加默认收起断言**

在 `scripts/check_victorian_century_company_tools_browser.mjs` 的求解器结果报告中增加：

```js
usage: {
  exists: Boolean(document.querySelector("[data-company-solver-usage]")),
  open: Boolean(document.querySelector("[data-company-solver-usage]")?.open),
},
```

并在现有求解结果断言后增加：

```js
assert.equal(solver.usage.exists, true, `${output.name} solver must show company usage`);
assert.equal(solver.usage.open, false, `${output.name} company usage must be collapsed by default`);
```

旧输出缺少数据属性时该检查会失败，证明 VC 页面检查能够捕获未同步状态。

- [ ] **Step 3: 生成两份 VC 输出**

Run:

```powershell
node scripts/build_victorian_century_site.mjs --source site --target "Victorian Century Database" --publish-target site/vc --vc-database database/victorian_century --skip-vc-assets
```

Expected: 输出 `"victorian_century_site_build": "ok"`，目标分别为 `Victorian Century Database` 和 `site/vc`。

- [ ] **Step 4: 运行 VC 静态和浏览器检查**

Run:

```powershell
node scripts/check_victorian_century_standalone_site.mjs
node scripts/check_victorian_century_company_tools_browser.mjs
```

Expected: 两项退出码均为 0；独立版与发布副本都显示公司使用率区域，且 `open` 为 `false`。

### Task 4: 工作记录与联合验证

**Files:**
- Modify: `docs/worklog/2026-08-18-company-building-composer.md`
- Modify: `WORKLOG.md`

- [ ] **Step 1: 更新详细工作记录**

在 `docs/worklog/2026-08-18-company-building-composer.md` 末尾增加“公司使用率折叠”小节，写明：默认收起、翻页保持手动展开、重新执行后收起、原版与两份 VC 同步、未推送和未公开部署。

- [ ] **Step 2: 更新根工作索引**

把 `WORKLOG.md` 顶部 2026-08-19 当前任务更新为公司使用率默认折叠的当前状态，并链接详细记录。根文件只保留一段简短索引。

- [ ] **Step 3: 运行完整联合验证**

Run:

```powershell
$checks = @(
  'scripts/check_company_solver_core.mjs',
  'scripts/check_company_solver_worker.mjs',
  'scripts/check_company_solver_contract.mjs',
  'scripts/check_company_solver_browser.mjs',
  'scripts/check_company_composer_core.mjs',
  'scripts/check_company_composer_contract.mjs',
  'scripts/check_company_composer_browser.mjs',
  'scripts/check_victorian_century_standalone_site.mjs',
  'scripts/check_victorian_century_main_entry.mjs',
  'scripts/check_victorian_century_company_tools_browser.mjs',
  'scripts/check_multilingual_bundles.mjs',
  'scripts/check_publish_bundle.mjs',
  'scripts/check_subsistence_building_map.mjs'
)
foreach ($check in $checks) {
  node $check
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
git diff --check
```

Expected: 所有检查退出码为 0；发布清单继续包含原版 1.13.10、原版 1.13.9 和 VC 文件；`git diff --check` 无空白错误。换行格式警告可以记录，但不得存在实际错误。

- [ ] **Step 4: 保留混合工作区并报告边界**

当前 `main` 包含本任务开始前的未提交内容，且 `site/app/company-solver.js` 等文件承载此前尚未单独提交的公司工具实现。本轮不要自动提交这些实现文件，也不要推送或公开部署。最终报告应明确区分本地完成、远端推送和公开部署三个状态。
