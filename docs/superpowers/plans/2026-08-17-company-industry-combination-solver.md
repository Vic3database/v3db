# 公司产业组合求解器实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 在原版 1.13.10 的公司板块增加按建筑反向求解极小公司组合的子页面，并提供二十项分页方案卡片与右栏组合详情。

**架构：** `company-solver-core.mjs` 只处理位掩码、固定建筑、互斥扩展建筑和极小集合搜索，供 Node 测试与 Worker 共用。Worker 保存完整的排序结果并按页回传二十项；页面模块只处理状态、渲染和 Worker 生命周期。公司、建筑、名贵商品和条件继续读取现有 1.13.10 数据分块。

**技术栈：** 原生浏览器 JavaScript、Web Worker、`BigInt`、Node `assert/strict`、现有 Chrome DevTools Protocol 浏览器测试。

---

### Task 1：建立可独立验证的求解核心

**文件：**

- Create: `site/app/company-solver-core.mjs`
- Create: `scripts/check_company_solver_core.mjs`

- [ ] **Step 1：写入失败测试**

在 `scripts/check_company_solver_core.mjs` 写入下列夹具。它覆盖固定建筑、单个扩展目标、同组两个目标、极小集合和额外固定覆盖：

```js
import assert from "node:assert/strict";
import { solveCompanyCombinations } from "../site/app/company-solver-core.mjs";

const buildings = ["coal", "steel", "tools", "rail"];
const companies = [
  { key: "a", name: "A", fixedBuildings: ["coal"], extensionBuildings: ["tools", "rail"] },
  { key: "b", name: "B", fixedBuildings: ["steel"], extensionBuildings: [] },
  { key: "c", name: "C", fixedBuildings: ["tools"], extensionBuildings: [] },
  { key: "d", name: "D", fixedBuildings: ["coal", "steel", "tools"], extensionBuildings: [] },
];
const onlyD = solveCompanyCombinations({ buildings, companies, targetKeys: ["coal", "steel", "tools"] });
assert.deepEqual(onlyD.solutions.map((item) => item.companyKeys), [["d"]]);
const conflictingExtension = solveCompanyCombinations({ buildings, companies: companies.slice(0, 3), targetKeys: ["coal", "tools", "rail"] });
assert.equal(conflictingExtension.solutions.length, 0);
const extension = solveCompanyCombinations({ buildings, companies: companies.slice(0, 3), targetKeys: ["coal", "tools"] });
assert.deepEqual(extension.solutions[0].selectedExtensions, { a: "tools" });
assert.deepEqual(extension.solutions[0].optionalBuildings, ["rail"]);
assert.equal(extension.solutions[0].extraFixedBuildingCount, 0);
console.log(JSON.stringify({ company_solver_core: "ok" }));
```

- [ ] **Step 2：运行失败测试**

运行：

```powershell
node scripts/check_company_solver_core.mjs
```

预期：报 `ERR_MODULE_NOT_FOUND`，指向 `site/app/company-solver-core.mjs`。

- [ ] **Step 3：实现纯求解接口**

创建 `site/app/company-solver-core.mjs`，导出 `createCompanySolverModel` 和 `solveCompanyCombinations`：

```js
export function createCompanySolverModel({ buildings, companies }) {
  const buildingIndex = new Map(buildings.map((key, index) => [key, index]));
  const maskFor = (keys) => (keys || []).reduce((mask, key) => (
    buildingIndex.has(key) ? mask | (1n << BigInt(buildingIndex.get(key))) : mask
  ), 0n);
  return {
    buildings: [...buildings],
    companies: companies.map((company, index) => ({
      index,
      key: company.key,
      name: company.name || company.key,
      fixedMask: maskFor(company.fixedBuildings),
      extensionMasks: [...new Set(company.extensionBuildings || [])].map((key) => ({ key, mask: maskFor([key]) })),
    })),
  };
}

export function solveCompanyCombinations({ buildings, companies, targetKeys, onProgress = () => {}, isCancelled = () => false }) {
  // 返回 { solutions, total, complete }。
}
```

在函数内按以下规则实现 DFS：目标和公司覆盖使用 `BigInt`；剔除不涉及目标的公司；为每个目标建立公司倒排索引；每层选择候选数最少的未覆盖目标；候选按新增覆盖数降序、名称和键升序处理；剩余候选并集无法覆盖缺口时剪枝；达到覆盖后只保留删去任一公司就不再满足目标的极小集合。

扩展建筑每家公司可以为空或选择一项。若该公司需要扩展建筑命中目标，分支只能选该目标建筑；同组两个目标不得由同一家公司同时覆盖。方案签名使用排序后的 `companyKey:selectedExtensionKey` 对；额外覆盖只计算固定建筑减去目标，未选扩展建筑放入 `optionalBuildings`。最后按公司数量升序、额外固定覆盖数降序、公司名称和键稳定排序。每 1,000 个节点调用 `onProgress({ nodes, solutionCount })`；取消时返回 `{ solutions: [], total: 0, complete: false }`。

- [ ] **Step 4：运行通过测试**

运行：

```powershell
node scripts/check_company_solver_core.mjs
```

预期：输出 `company_solver_core: "ok"`。

- [ ] **Step 5：提交核心**

```powershell
git add site/app/company-solver-core.mjs scripts/check_company_solver_core.mjs
git commit -m "feat: add company combination solver core"
```

### Task 2：用 Worker 保存结果并按页返回

**文件：**

- Create: `site/app/company-solver-worker.js`
- Create: `scripts/check_company_solver_worker.mjs`

- [ ] **Step 1：写入 Worker 协议失败测试**

```js
import assert from "node:assert/strict";
import fs from "node:fs";
const worker = fs.readFileSync("site/app/company-solver-worker.js", "utf8");
assert.match(worker, /import\s*\{\s*solveCompanyCombinations\s*\}\s*from\s*["']\.\/company-solver-core\.mjs["']/);
for (const type of ["solve", "page", "cancel", "dispose"]) assert.match(worker, new RegExp(`message\\.type\\s*===\\s*["']${type}["']`));
assert.match(worker, /type:\s*["']complete["']/);
assert.match(worker, /type:\s*["']page["']/);
console.log(JSON.stringify({ company_solver_worker: "ok" }));
```

- [ ] **Step 2：运行失败测试**

```powershell
node scripts/check_company_solver_worker.mjs
```

预期：读取 `site/app/company-solver-worker.js` 失败。

- [ ] **Step 3：实现 Worker 协议**

创建 Worker，采用下列框架：

```js
import { solveCompanyCombinations } from "./company-solver-core.mjs";

let activeJobId = 0;
let completed = null;
self.addEventListener("message", ({ data: message }) => {
  if (message.type === "cancel") { activeJobId += 1; completed = null; return; }
  if (message.type === "dispose") { close(); return; }
  if (message.type === "page") return postPage(message);
  if (message.type === "solve") runSolve(message);
});
```

`runSolve` 保存本轮任务编号，转发 `progress`，并在完成后保存全部排序方案，回传 `{ type: "complete", requestId, total, pageCount }`，其中 `pageCount = Math.max(1, Math.ceil(total / 20))`。 `postPage` 回传 `solutions.slice((page - 1) * 20, page * 20)`。取消、过期或不同 `requestId` 的任务不得回传消息。

- [ ] **Step 4：运行通过测试并提交**

```powershell
node scripts/check_company_solver_worker.mjs
git add site/app/company-solver-worker.js scripts/check_company_solver_worker.mjs
git commit -m "feat: run company solver in a worker"
```

预期：测试输出 `company_solver_worker: "ok"`。

### Task 3：加入公司子路由、48 项目录和本地化

**文件：**

- Modify: `site/app/runtime.js:135-239, 462-557, 789-800`
- Modify: `site/app/data.js:68-105, 356-430`
- Modify: `site/app/ui.js:1289-1322, 1495-1659`
- Modify: `site/app/boards.js:1632-1645, 1980-2011`
- Modify: `site/index.html:128-153, 402-427`
- Modify: `scripts/site_frontend_sources.mjs:4-37`
- Modify: `site/locales/ui.zh-Hans.js:687-723`
- Modify: `site/locales/ui.en.js:687-723`
- Create: `scripts/check_company_solver_contract.mjs`

- [ ] **Step 1：写入路由和目录的失败合同测试**

```js
assert.match(app, /function\s+companySolverAvailable\s*\([^)]*\)[\s\S]*loadedDataVersion\s*===\s*["']1\.13\.10["']/);
assert.match(app, /parts\[0\]\s*===\s*["']company["']\s*&&\s*parts\[1\]\s*===\s*["']solver["']/);
assert.match(index, /id="companySolverViewButton"/);
assert.match(index, /app\/company-solver\.js\?v=/);
assert.equal(companySolverBuildingKeys.length, 48);
assert.deepEqual(companySolverBuildingKeys.slice(0, 10), [
  "building_coal_mine", "building_iron_mine", "building_lead_mine", "building_sulfur_mine", "building_gold_mine",
  "building_fishing_wharf", "building_whaling_station", "building_logging_camp", "building_rubber_plantation", "building_oil_rig",
]);
assert.equal(companySolverBuildingKeys.includes("building_gold_field"), false);
```

测试同时读取中英文界面语言文件，断言两份文件都有 `board.company.solver`、`board.company.solverRun`、`board.company.solverPage`、`board.company.solverNoTarget`。

- [ ] **Step 2：运行失败合同测试**

```powershell
node scripts/check_company_solver_contract.mjs
```

预期：缺少 `companySolverAvailable` 或 `companySolverBuildingKeys`。

- [ ] **Step 3：定义运行时状态和建筑目录**

在 `runtime.js` 增加：

```js
const COMPANY_SOLVER_PAGE_SIZE = 20;
const companySolverBuildingGroups = [
  { key: "mines", buildingKeys: ["building_coal_mine", "building_iron_mine", "building_lead_mine", "building_sulfur_mine", "building_gold_mine"] },
  { key: "resources", buildingKeys: ["building_fishing_wharf", "building_whaling_station", "building_logging_camp", "building_rubber_plantation", "building_oil_rig"] },
  // 其余五组严格复用 resourceFilterGroups 的既有顺序。
];
const companySolverBuildingKeys = companySolverBuildingGroups.flatMap((group) => group.buildingKeys);
```

补齐农业 16 项、轻工业 7 项、重工业 7 项、军工业 3 项、基建及其他 5 项，合计 48 项。金矿区不得加入。为 `state` 增加 `companySolverTargets`、`companySolverPage`、`companySolverRequestId`、`companySolverStatus`、`companySolverTotal`、`companySolverPageCount`、`companySolverPageSolutions` 和 `companySolverSelectedSolution`；在 `resetDatasetState()` 调用 `resetCompanySolverState()`。

- [ ] **Step 4：接入门控、入口、哈希和分派**

在 `data.js` 定义：

```js
function companySolverAvailable() {
  return !standaloneSiteConfig && loadedDataVersion === "1.13.10";
}
```

在 `ui.js` 的普通公司详情判断之前识别 `#/company/solver`。可用时令 `state.view = "company"` 和 `state.detailKind = "companySolver"`；历史版本或 Victorian Century 改写为 `#/company`。在 `index.html` 的公司左栏加 `companySolverViewButton`；求解器路由时隐藏普通公司筛选和地图，只保留公司列表与求解器入口。为 `company-solver.js` 加普通脚本标签，Worker 和 `.mjs` 不加普通标签；把三个求解器文件加入 `site_frontend_sources.mjs`。

在 `boards.js` 的 `renderCompanyBoard()` 开头加入：

```js
if (state.detailKind === "companySolver") {
  renderCompanySolverBoard();
  renderMap([]);
  return;
}
```

在 `renderDetailForState()` 中为 `companySolver` 调用 `renderCompanySolverDetail()`。补齐中英文的执行、清空、总数、页码、前后页、计算中、不可覆盖、方案、选中项、额外项、可选项、硬性限制、组合详情、固定建筑、当前扩展和可替代扩展文案。

- [ ] **Step 5：运行合同测试并提交**

```powershell
node scripts/check_company_solver_contract.mjs
git add site/app/runtime.js site/app/data.js site/app/ui.js site/app/boards.js site/index.html scripts/site_frontend_sources.mjs site/locales/ui.zh-Hans.js site/locales/ui.en.js scripts/check_company_solver_contract.mjs
git commit -m "feat: add company solver route and controls"
```

预期：合同输出 `company_solver_contract: "ok"`，目录为 48 项。

### Task 4：实现主线程控制、方案列表与响应式卡片

**文件：**

- Create: `site/app/company-solver.js`
- Modify: `site/app/boards.js:1632-1645`
- Modify: `site/app/components.js:577-612, 2053-2065`
- Modify: `site/styles/records.css:1284-1825`
- Modify: `scripts/check_company_solver_contract.mjs`

- [ ] **Step 1：扩展失败合同测试**

```js
assert.match(app, /new Worker\([\s\S]*company-solver-worker\.js[\s\S]*type:\s*["']module["']/);
assert.match(app, /data-company-solver-building/);
assert.match(app, /data-company-solver-run/);
assert.match(app, /data-company-solver-page/);
assert.match(app, /data-company-solver-open/);
assert.doesNotMatch(functionSource(app, "renderCompanySolverCard"), /href=/);
assert.match(styles, /\.company-solver-building-grid/);
assert.match(styles, /\.company-solver-card/);
```

- [ ] **Step 2：运行失败合同测试**

```powershell
node scripts/check_company_solver_contract.mjs
```

预期：缺少 Worker 或 `data-company-solver-building`。

- [ ] **Step 3：实现 Worker 生命周期**

在 `company-solver.js` 实现 `ensureCompanySolverWorker()`、`runCompanySolver()`、`requestCompanySolverPage(page)`、`invalidateCompanySolverResults()` 和 `resetCompanySolverState()`。Worker 构造必须为：

```js
new Worker("app/company-solver-worker.js", { type: "module" });
```

发送的数据只包含 221 家公司各自的键、本地化名称、`building_types` 键和 `extension_building_types` 键。消息仅在 `requestId === state.companySolverRequestId` 时生效；完成消息自动请求第 1 页；改目标、换版本或离开路由时取消旧任务，清空已选方案。

- [ ] **Step 4：渲染图标选择和二十项分页**

`renderCompanySolverBoard()` 按 `companySolverBuildingGroups` 输出 48 个 `data-company-solver-building` 按钮和末尾 `data-company-solver-run` 按钮。建筑图标使用 `buildingIconHtml(key)`，选中状态使用 `aria-pressed`。空选时不启动 Worker；任何选择变化立即使旧结果失效。

结果区显示精确总数、当前页码、前后页按钮和至多二十张 `.company-solver-card`。每卡只有一个 `data-company-solver-open` 箭头。第一行左侧为所有公司图标、右侧为全部名贵商品；第二行依次为选中建筑、额外固定建筑和圆括号内的可选扩展建筑；第三行只在有文化或国家限制时出现。列表卡中的公司、建筑和商品全部是 `span`，不能调用 `conceptHref()`。

- [ ] **Step 5：添加桌面和窄屏样式**

在 `records.css` 添加 `.company-solver-shell`、`.company-solver-toolbar`、`.company-solver-building-grid`、`.company-solver-building`、`.company-solver-card`、`.company-solver-card-head`、`.company-solver-card-lines`、`.company-solver-card-companies`、`.company-solver-card-prestige`、`.company-solver-card-buildings`、`.company-solver-optional-group`、`.company-solver-card-restrictions` 和 `.company-solver-pagination`。

桌面端公司图标与名贵商品同一行，产业关系在第二行。窄屏下按公司图标、名贵商品、选中项、额外项、可选项、硬性限制分行；没有内容的行不渲染。箭头的点击区域至少为 36 像素，页面不得横向溢出。

- [ ] **Step 6：运行通过测试并提交**

```powershell
node scripts/check_company_solver_core.mjs
node scripts/check_company_solver_worker.mjs
node scripts/check_company_solver_contract.mjs
node scripts/check_frontend_file_split.mjs
git add site/app/company-solver.js site/app/boards.js site/app/components.js site/styles/records.css scripts/check_company_solver_contract.mjs
git commit -m "feat: render paginated company solver results"
```

预期：四项测试均通过。

### Task 5：实现右栏组合详情和详情内跳转

**文件：**

- Modify: `site/app/company-solver.js`
- Modify: `site/app/boards.js:1980-2011`
- Modify: `site/app/components.js:202-244, 577-612`
- Modify: `site/styles/records.css:1284-1825`
- Modify: `scripts/check_company_solver_contract.mjs`

- [ ] **Step 1：写入详情边界失败测试**

```js
const listCard = functionSource(app, "renderCompanySolverCard");
const detail = functionSource(app, "renderCompanySolverDetail");
assert.doesNotMatch(listCard, /conceptHref\(/);
assert.match(listCard, /data-company-solver-open/);
assert.match(detail, /conceptHref\(["']company["']/);
assert.match(detail, /conceptHref\(["']building["']/);
assert.match(detail, /conceptHref\(["']goods["']/);
assert.match(detail, /possible_raw[\s\S]*prosperity_modifiers[\s\S]*possible_prestige_goods/);
```

- [ ] **Step 2：运行失败测试**

```powershell
node scripts/check_company_solver_contract.mjs
```

预期：失败信息指出缺少 `renderCompanySolverDetail`。

- [ ] **Step 3：选择组合并渲染右栏**

为 `data-company-solver-open` 绑定事件，把 `{ ordinal, solution }` 写入 `state.companySolverSelectedSolution` 并调用 `renderCompanySolverDetail()`。箭头不改哈希，也不打开普通公司详情。翻页、重新求解和改变目标时清空选择。

右栏未选方案时显示求解器说明。选中后显示方案编号、公司数、目标覆盖数和额外固定建筑数。每家公司详情卡必须显示固定建筑、当前扩展建筑、可替代扩展建筑、`potential_raw`、`attainable_raw`、`possible_raw`、`prosperity_modifiers`、`possible_prestige_goods`、`referenced_cultures` 与 `referenced_countries`。原始条件使用现有 `rawDetails()`，限制只作为摘要，不将复杂脚本夸大为绝对锁定。

详情内公司、建筑分别使用既有 `conceptHref()`；名贵商品用 `prestigeGoodByKey.get(key)?.base_good_key` 取得基础商品键后再生成 `#/goods/<base_good_key>`。`conceptHref()` 目前没有 `building`、`goods` 或名贵商品分支，不能直接用于这三类项目。实现一个只供求解器详情使用的链接辅助函数，避免改动其他板块的既有链接语义：

```js
conceptHref("company", company.key);
`#/building/${encodeURIComponent(building.key)}`;
`#/goods/${encodeURIComponent(prestigeGood.base_good_key)}`;
```

- [ ] **Step 4：添加详情样式、运行测试并提交**

```powershell
node scripts/check_company_solver_contract.mjs
node scripts/check_right_panel_layout.mjs
git add site/app/company-solver.js site/app/boards.js site/app/components.js site/styles/records.css scripts/check_company_solver_contract.mjs
git commit -m "feat: add company solver combination detail"
```

预期：合同和右栏布局检查均通过。

### Task 6：验证真实数据、浏览器交互和工作记录

**文件：**

- Create: `scripts/check_company_solver_browser.mjs`
- Modify: `scripts/check_company_solver_contract.mjs`
- Create: `docs/worklog/2026-08-17-company-industry-combination-solver.md`
- Modify: `WORKLOG.md`

- [ ] **Step 1：扩展真实数据断言**

在合同测试用 `readChunkedSiteData(root, "site/versions/1.13.10")` 读取数据，断言 `companies.length === 221`，并验证 `company_bombay_burmah_trading_corporation` 的固定建筑包含伐木营地和橡胶种植园、扩展建筑包含油井。另断言 `prestige_good_burmese_teak.base_good_key === "hardwood"`，确保详情链接进入木材商品页。该断言确保浏览器用例使用的真实数据没有漂移。

- [ ] **Step 2：编写浏览器回归**

`check_company_solver_browser.mjs` 复用 `check_global_content_search_browser.mjs` 的临时 HTTP 服务器和 Chrome DevTools Protocol 封装，只打开 `site/index.html?version=1.13.10&lang=zh-Hans#/company/solver`。执行下列流程：

```js
await page.waitFor(() => document.querySelectorAll("[data-company-solver-building]").length === 48, "48 solver buildings");
assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-company-solver-building='building_gold_mine']"))), true);
assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-company-solver-building='building_gold_field']"))), false);
for (const key of ["building_rubber_plantation", "building_oil_rig", "building_tooling_workshop"]) {
  await page.click(`[data-company-solver-building="${key}"]`);
}
await page.click("[data-company-solver-run]");
await page.waitFor(() => document.querySelectorAll(".company-solver-card").length > 0, "solver results");
```

断言页面中至多二十张卡片；每卡无锚点、只有一个右箭头；可选建筑处于 `.company-solver-optional-group`；点击箭头后右栏出现公司、建筑和名贵商品链接；再点一个目标建筑后旧卡片消失并出现重新执行提示。用 `390 × 844` 复跑，断言六行内容没有横向溢出，且没有限制时不渲染限制行。

- [ ] **Step 3：运行全量验证**

```powershell
node scripts/check_company_solver_core.mjs
node scripts/check_company_solver_worker.mjs
node scripts/check_company_solver_contract.mjs
node scripts/check_company_solver_browser.mjs
node scripts/check_company_detail_location_map.mjs
node scripts/check_ui_ideology_contracts.mjs
node scripts/check_right_panel_layout.mjs
node scripts/check_publish_bundle.mjs
git diff --check
```

预期：全部命令成功；浏览器脚本报告桌面与 390 × 844 窄屏通过；`git diff --check` 无输出。

- [ ] **Step 4：写工作记录并提交**

在工作记录写明仅支持原版 1.13.10、48 项目录、金矿区排除、固定与互斥扩展规则、Worker 精确总数、每页二十项、真实浏览器用例、未同步 Victorian Century，以及执行过的验证命令。更新根 `WORKLOG.md` 的一条摘要和链接，不写推送或发布声明。

```powershell
git add scripts/check_company_solver_browser.mjs scripts/check_company_solver_contract.mjs docs/worklog/2026-08-17-company-industry-combination-solver.md WORKLOG.md
git commit -m "test: verify company industry combination solver"
```

## 计划自检

48 项目录、金矿与金矿区规则、1.13.10 门控、固定与互斥扩展、同组多目标、极小集合、唯一性、排序、精确总数、每页二十项、列表无跳转、右箭头、右栏详情、桌面与窄屏、文化与国家限制、原始条件、静态和浏览器验证均有任务覆盖。函数名、Worker 消息名和状态字段在各任务中一致；全文没有待定项或占位符。
