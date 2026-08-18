# Victorian Century 公司工具同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让公司产业组合求解器和公司建筑组合器使用 Victorian Century 的 231 家公司及相关建筑、名贵商品、限制和繁荣效果数据，并同步到两个独立 VC 站点。

**Architecture:** 保留 `site/` 为唯一功能源码，以当前数据环境决定两个公司工具是否可用。现有求解核心与组合核心直接读取当前资料库数据，`scripts/build_victorian_century_site.mjs` 负责把脚本、样式和页面引用复制到 `Victorian Century Database/` 与 `site/vc/`。新增独立浏览器回归，验证两个 VC 输出中的入口、求解结果、VC 新增公司、组合汇总及窄屏布局。

**Tech Stack:** 原生 JavaScript、Web Worker、BigInt 位掩码、Node.js 静态检查、Chrome DevTools Protocol、现有 VC 静态站构建器。

---

### Task 1: 以合同检查定义 VC 可用性

**Files:**
- Modify: `scripts/check_company_solver_contract.mjs`
- Modify: `scripts/check_company_composer_contract.mjs`
- Modify: `site/app/company-solver.js:10-12`
- Modify: `site/app/company-composer.js:8-10`

- [ ] **Step 1: 在合同检查中写入失败断言**

在求解器合同中加入：

```js
assert.match(solver, /companies\.length > 0 && \(Boolean\(standaloneSiteConfig\) \|\| loadedDataVersion === "1\.13\.10"\)/, "solver must support base 1.13.10 and standalone VC data");
```

在组合器合同中加入：

```js
const composer = read("site/app/company-composer.js");
assert.match(composer, /companies\.length > 0 && \(Boolean\(standaloneSiteConfig\) \|\| loadedDataVersion === "1\.13\.10"\)/, "composer must support base 1.13.10 and standalone VC data");
```

- [ ] **Step 2: 运行合同检查并确认按预期失败**

Run:

```powershell
node scripts/check_company_solver_contract.mjs
node scripts/check_company_composer_contract.mjs
```

Expected: 两项检查都因当前 `!standaloneSiteConfig` 排除 VC 而失败。

- [ ] **Step 3: 放开两个功能的 VC 可用性**

将两个可用性函数分别改为：

```js
function companySolverAvailable() {
  return companies.length > 0 && (Boolean(standaloneSiteConfig) || loadedDataVersion === "1.13.10");
}
```

```js
function companyComposerAvailable() {
  return companies.length > 0 && (Boolean(standaloneSiteConfig) || loadedDataVersion === "1.13.10");
}
```

该判断允许独立 VC 站点使用已载入的数据，同时继续排除主站的原版 1.13.9。

- [ ] **Step 4: 运行合同检查并确认通过**

Run:

```powershell
node --check site/app/company-solver.js
node --check site/app/company-composer.js
node scripts/check_company_solver_contract.mjs
node scripts/check_company_composer_contract.mjs
```

Expected: 语法与两项合同检查全部通过。

- [ ] **Step 5: 提交可用性改动**

仅在这些文件没有混入其他未提交工作时提交；若存在重叠改动，则保留在工作区并在最终记录说明，不创建混合提交。

```powershell
git add -- site/app/company-solver.js site/app/company-composer.js scripts/check_company_solver_contract.mjs scripts/check_company_composer_contract.mjs
git commit -m "feat: enable company tools for VC"
```

### Task 2: 以静态检查定义 VC 输出合同

**Files:**
- Modify: `scripts/check_victorian_century_standalone_site.mjs:15-42`
- Modify: `site/index.html:413-421`
- Generated: `Victorian Century Database/index.html`
- Generated: `Victorian Century Database/app/company-solver.js`
- Generated: `Victorian Century Database/app/company-solver-core.mjs`
- Generated: `Victorian Century Database/app/company-solver-core-fallback.js`
- Generated: `Victorian Century Database/app/company-solver-async-fallback.js`
- Generated: `Victorian Century Database/app/company-solver-worker.js`
- Generated: `Victorian Century Database/app/company-composer-core.js`
- Generated: `Victorian Century Database/app/company-composer.js`
- Generated: `site/vc/index.html`
- Generated: `site/vc/app/company-solver.js`
- Generated: `site/vc/app/company-solver-core.mjs`
- Generated: `site/vc/app/company-solver-core-fallback.js`
- Generated: `site/vc/app/company-solver-async-fallback.js`
- Generated: `site/vc/app/company-solver-worker.js`
- Generated: `site/vc/app/company-composer-core.js`
- Generated: `site/vc/app/company-composer.js`

- [ ] **Step 1: 扩充 VC 独立站静态检查**

把以下五项加入 `expectedModules`，要求页面直接载入：

```js
"app/company-solver-core-fallback.js",
"app/company-solver-async-fallback.js",
"app/company-solver.js",
"app/company-composer-core.js",
"app/company-composer.js",
```

新增完整文件集合并核对两个输出与主站源码一致：

```js
const expectedCompanyToolFiles = [
  "app/company-solver-core.mjs",
  "app/company-solver-core-fallback.js",
  "app/company-solver-async-fallback.js",
  "app/company-solver-worker.js",
  "app/company-solver.js",
  "app/company-composer-core.js",
  "app/company-composer.js",
];

for (const relative of expectedCompanyToolFiles) {
  const sourceFile = path.join(root, "site", relative);
  const standaloneFile = path.join(siteRoot, relative);
  const publishedFile = path.join(publishedRoot, relative);
  assert(fs.existsSync(standaloneFile), `missing standalone VC company tool: ${relative}`);
  assert(fs.existsSync(publishedFile), `missing published VC company tool: ${relative}`);
  assert.equal(fs.readFileSync(standaloneFile).equals(fs.readFileSync(sourceFile)), true, `standalone VC company tool differs from source: ${relative}`);
  assert.equal(fs.readFileSync(publishedFile).equals(fs.readFileSync(standaloneFile)), true, `published VC company tool differs from standalone: ${relative}`);
}
```

页面检查增加两个界面脚本的新缓存标识：

```js
assert.match(html, /app\/company-solver\.js\?v=20260818-vc-company-tools1/);
assert.match(html, /app\/company-composer\.js\?v=20260818-vc-company-tools1/);
```

- [ ] **Step 2: 运行 VC 静态检查并确认缺少文件或缓存标识**

Run:

```powershell
node scripts/check_victorian_century_standalone_site.mjs
```

Expected: 当前 VC 输出没有公司工具脚本，检查失败。

- [ ] **Step 3: 更新主页面的界面脚本缓存标识**

在 `site/index.html` 中只更新两个界面脚本：

```html
<script src="app/company-solver.js?v=20260818-vc-company-tools1"></script>
<script src="app/company-composer.js?v=20260818-vc-company-tools1"></script>
```

同步修改 `scripts/check_company_solver_contract.mjs` 与 `scripts/check_company_composer_contract.mjs` 的对应缓存断言。

- [ ] **Step 4: 核对构建目标后运行 VC 构建**

先确认三个绝对路径均位于当前仓库，并且发布目标准确为 `site/vc`：

```powershell
Resolve-Path site
Resolve-Path "Victorian Century Database"
Resolve-Path site/vc
```

再运行：

```powershell
node scripts/build_victorian_century_site.mjs --source site --target "Victorian Century Database" --publish-target site/vc --vc-database database/victorian_century --skip-vc-assets
```

Expected: 输出 `victorian_century_site_build: "ok"`，两个 VC 输出均包含七个公司工具文件和新页面引用。

- [ ] **Step 5: 运行静态检查并确认通过**

Run:

```powershell
node scripts/check_victorian_century_standalone_site.mjs
node scripts/check_victorian_century_main_entry.mjs
node scripts/check_publish_bundle.mjs
```

Expected: VC 独立站、主入口和发布文件清单检查全部通过。

- [ ] **Step 6: 提交缓存与静态合同改动**

VC 生成目录由 `.gitignore` 排除，不加入提交。其余文件若含有既存改动，继续保留在工作区并记录。

```powershell
git add -- site/index.html scripts/check_company_solver_contract.mjs scripts/check_company_composer_contract.mjs scripts/check_victorian_century_standalone_site.mjs
git commit -m "test: cover VC company tool output"
```

### Task 3: 增加两个 VC 输出的浏览器回归

**Files:**
- Create: `scripts/check_victorian_century_company_tools_browser.mjs`

- [ ] **Step 1: 编写失败的 VC 公司工具浏览器检查**

新脚本使用 Chrome DevTools Protocol，依次检查以下两个入口：

```js
const roots = [
  path.join(root, "Victorian Century Database", "index.html"),
  path.join(root, "site", "vc", "index.html"),
];
```

每个入口在 1440×1000 下验证普通公司页同时显示两个入口：

```js
await page.goto(pathToFileURL(indexFile).href + "?lang=zh-Hans#/company");
await page.waitFor(() => document.body.dataset.view === "company" && companies.length === 231, "VC company data");
assert.equal(await page.evaluate(() => Boolean(document.querySelector("#companySolverEntry:not([hidden])"))), true);
assert.equal(await page.evaluate(() => Boolean(document.querySelector("#companyComposerEntry:not([hidden])"))), true);
```

组合器验证 231 家公司与 VC 新增公司 `company_benz_cie`：

```js
await page.click("[data-company-composer-entry]");
await page.waitFor(() => document.body.dataset.companyComposer === "true" && document.querySelectorAll("[data-company-composer-company]").length === 231, "VC composer wall");
await page.click("[data-company-composer-company='company_benz_cie']");
const summary = await page.evaluate(() => window.__companyComposerDebug());
assert.deepEqual(summary.selectedCompanyKeys, ["company_benz_cie"]);
assert.equal(summary.buildingGroups.flatMap((group) => group.buildingKeys).includes("building_automotive_industry"), true);
assert.equal(summary.buildingGroups.flatMap((group) => group.buildingKeys).includes("building_motor_industry"), true);
assert.equal(await page.evaluate(() => Boolean(document.querySelector("[data-company-composer-extension='building_tooling_workshop']"))), true);
assert.equal(await page.evaluate(() => Boolean(document.querySelector(".company-composer-good-link[title*='奔驰']")) || Boolean(document.querySelector(".company-composer-good-link img[src*='prestige_good_benz_car']"))), true);
```

求解器验证 48 项建筑与 VC 新增公司参与结果。选择汽车厂和动力机械厂，固定公司数为 1，并勾选 `prestige_good_benz_car`，从而使结果必须包含 `company_benz_cie`：

```js
await page.goto(pathToFileURL(indexFile).href + "?lang=zh-Hans#/company/solver");
await page.waitFor(() => document.querySelectorAll("[data-company-solver-building]").length === 48, "VC solver buildings");
for (const key of ["building_automotive_industry", "building_motor_industry"]) await page.click(`[data-company-solver-building='${key}']`);
await page.click(".company-solver-prestige-filter summary");
await page.click("[data-company-solver-prestige='prestige_good_benz_car']");
await page.click("[data-company-solver-run]");
await page.waitFor(() => document.querySelectorAll(".company-solver-card").length > 0, "VC solver result");
assert.equal(await page.evaluate(() => state.companySolver.solutions.every((solution) => solution.companyKeys.includes("company_benz_cie"))), true);
```

对 390×844 再打开两个子页面，确认 `document.documentElement.scrollWidth <= document.documentElement.clientWidth`，入口与控件可见。

- [ ] **Step 2: 在未同步 VC 输出上运行并确认失败**

Run:

```powershell
node scripts/check_victorian_century_company_tools_browser.mjs
```

Expected: 在 Task 2 构建前因 VC 入口隐藏或脚本缺失而失败。若 Task 2 已完成，临时对旧 VC 快照运行以保留红灯证据，随后恢复当前输出。

- [ ] **Step 3: 运行当前 VC 输出并确认通过**

Run:

```powershell
node --check scripts/check_victorian_century_company_tools_browser.mjs
node scripts/check_victorian_century_company_tools_browser.mjs
```

Expected: 两个 VC 输出的桌面与窄屏检查全部通过；输出报告列出 231 家公司、48 项求解建筑、Benz 组合汇总与 Benz 求解结果。

- [ ] **Step 4: 提交浏览器检查**

```powershell
git add -- scripts/check_victorian_century_company_tools_browser.mjs
git commit -m "test: verify VC company tools in browsers"
```

### Task 4: 运行完整回归并记录本地状态

**Files:**
- Modify: `docs/worklog/2026-08-18-company-building-composer.md`
- Modify: `WORKLOG.md`

- [ ] **Step 1: 运行公司工具及 VC 完整回归**

Run:

```powershell
$ErrorActionPreference = "Stop"
node scripts/check_company_solver_core.mjs
node scripts/check_company_solver_worker.mjs
node scripts/check_company_solver_contract.mjs
node scripts/check_company_solver_browser.mjs
node scripts/check_company_composer_core.mjs
node scripts/check_company_composer_contract.mjs
node scripts/check_company_composer_browser.mjs
node scripts/check_victorian_century_standalone_site.mjs
node scripts/check_victorian_century_main_entry.mjs
node scripts/check_victorian_century_browser.mjs "file:///D:/Bot/Vic3/Victoria3_DB/Victorian Century Database/index.html" building goods
node scripts/check_victorian_century_browser.mjs "file:///D:/Bot/Vic3/Victoria3_DB/site/vc/index.html" building goods
node scripts/check_victorian_century_company_tools_browser.mjs
node scripts/check_publish_bundle.mjs
git diff --check
```

Expected: 全部命令退出码为 0。原版 1.13.10 功能不变，原版 1.13.9 路由继续回退，两个 VC 输出支持求解器和组合器。

- [ ] **Step 2: 更新详细工作记录**

在 `docs/worklog/2026-08-18-company-building-composer.md` 增加“Victorian Century 同步”段落，写明：

```text
公司产业组合求解器和公司建筑组合器已经同步到 Victorian Century。两个工具读取 VC 全量 231 家公司和 98 种名贵商品，保留现有 48 项建筑、互斥扩展、限制条件和繁荣效果合并规则。独立 Victorian Century Database 与 site/vc 的静态和浏览器检查均通过；原版 1.13.9 仍不开放入口。
```

同时记录实际执行的检查、生成目录被忽略的状态，以及是否提交、推送或部署。

- [ ] **Step 3: 更新根工作索引**

在 `WORKLOG.md` 的 2026-08-18 当前状态中增加一行简短索引，指向上述详细记录，不复制长篇验证内容。

- [ ] **Step 4: 核对最终工作区范围**

Run:

```powershell
git status --short --branch
git diff --stat
git diff --check
```

Expected: 没有空白错误；明确列出本任务的源码、检查与记录，以及工作区中此前已有的其他改动。

- [ ] **Step 5: 提交工作记录**

仅在两个记录文件可以与既存内容安全分离时提交：

```powershell
git add -- WORKLOG.md docs/worklog/2026-08-18-company-building-composer.md
git commit -m "docs: record VC company tools sync"
```

功能实现完成后只报告本地、提交、推送和部署的实际状态，不把本地验证表述为已经公开发布。
