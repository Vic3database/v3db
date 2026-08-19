# Company Composer Overlap Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在公司建筑组合器的合并建筑图标上标出多家公司对同一建筑的重复覆盖数量，并在悬停内容中列出来源公司。

**Architecture:** `site/app/company-composer-core.js` 在既有建筑去重与排序过程中同时生成 `buildingSources` 普通对象，每个建筑键对应按选择顺序排列的公司键数组。`site/app/company-composer.js` 读取该对象，为重复覆盖建筑渲染 `×N` 角标和本地化悬停内容；样式仅增加图标内部的绝对定位角标，不改变图标占位。原版验证通过后重新生成 `Victorian Century Database/` 与 `site/vc/`，使用共享浏览器检查确认同步。

**Tech Stack:** 原生 JavaScript、HTML 字符串模板、CSS、Node.js `assert`、Chrome DevTools Protocol、Victorian Century 静态站点构建脚本。

---

## 文件职责

- `site/app/company-composer-core.js`：组合器的纯数据汇总，新增每个建筑的来源公司索引。
- `site/app/company-composer.js`：将来源索引转换为角标、悬停文本和建筑详情链接。
- `site/styles/records.css`：重复覆盖角标的尺寸、位置和颜色。
- `site/index.html`、`site/styles.css`：更新组合器核心、界面和样式缓存标识。
- `scripts/check_company_composer_core.mjs`：验证固定建筑、已选扩展、公司内去重和选择顺序。
- `scripts/check_company_composer_contract.mjs`：验证数据字段、标记结构和缓存链存在。
- `scripts/check_company_composer_browser.mjs`：验证原版桌面及窄屏的 `×2`、悬停公司名、扩展取消和几何。
- `scripts/check_victorian_century_company_tools_browser.mjs`：验证两份 VC 输出继续加载共享组合器，并显示真实重复覆盖标记。
- `docs/worklog/2026-08-18-company-building-composer.md`、`WORKLOG.md`：记录实现、验证和本地状态。

### Task 1: 核心来源统计

**Files:**
- Modify: `scripts/check_company_composer_core.mjs:22-102`
- Modify: `site/app/company-composer-core.js:2-57`

- [ ] **Step 1: 写入固定建筑与已选扩展来源的失败检查**

在 `summary` 断言后加入：

```js
assert.deepEqual(JSON.parse(JSON.stringify(summary.buildingSources)), {
  building_coal_mine: ["company_alpha"],
  building_iron_mine: ["company_beta"],
  building_tooling_workshop: ["company_beta", "company_alpha"],
  building_steel_mill: ["company_alpha"],
  building_wheat_farm: ["company_gamma"],
  building_unclassified: ["company_gamma"],
}, "building sources deduplicate each company and retain selection order");
```

把 `company_alpha.building_types` 中的 `building_tooling_workshop` 再重复一次，证明同一公司不会重复计数。新增一次组合：`company_beta` 固定覆盖 `building_tooling_workshop`，`company_alpha` 把同一建筑作为当前扩展，断言来源为 `company_beta, company_alpha`；清除扩展后断言只剩 `company_beta`。

- [ ] **Step 2: 运行核心检查并确认因字段缺失失败**

Run: `node scripts/check_company_composer_core.mjs`

Expected: FAIL，`summary.buildingSources` 为 `undefined`，或扩展来源断言不成立。

- [ ] **Step 3: 实现最小来源统计**

将 `summarizeBuildings` 改为按公司建立建筑集合，并返回普通对象：

```js
function summarizeBuildings(companies, selectedExtensions, buildingGroups) {
  const selectedKeys = new Set();
  const buildingSources = {};
  for (const company of companies) {
    const companyBuildingKeys = new Set((company.building_types || []).map((item) => item?.key).filter(Boolean));
    if (selectedExtensions[company.key]) companyBuildingKeys.add(selectedExtensions[company.key]);
    for (const key of companyBuildingKeys) {
      selectedKeys.add(key);
      if (!buildingSources[key]) buildingSources[key] = [];
      buildingSources[key].push(company.key);
    }
  }
  const classifiedKeys = new Set();
  const groups = [];
  for (const group of buildingGroups || []) {
    const buildingKeys = (group.buildingKeys || []).filter((key) => selectedKeys.has(key));
    for (const key of buildingKeys) classifiedKeys.add(key);
    if (buildingKeys.length) groups.push({ key: group.key, buildingKeys });
  }
  return {
    groups,
    unclassifiedBuildingKeys: [...selectedKeys].filter((key) => !classifiedKeys.has(key)),
    buildingSources,
  };
}
```

在 `composeCompanyBuildings` 返回对象中加入：

```js
buildingSources: buildingSummary.buildingSources,
```

- [ ] **Step 4: 运行核心检查并确认通过**

Run: `node scripts/check_company_composer_core.mjs`

Expected: `company composer core checks passed`

- [ ] **Step 5: 提交核心与核心检查**

```powershell
git add -- site/app/company-composer-core.js scripts/check_company_composer_core.mjs
git commit -m "feat: track company building coverage sources"
```

### Task 2: 角标与悬停内容

**Files:**
- Modify: `scripts/check_company_composer_contract.mjs:14-50`
- Modify: `scripts/check_company_composer_browser.mjs:89-141`
- Modify: `site/app/company-composer.js:55-143`
- Modify: `site/styles/records.css:2132-2167`
- Modify: `site/index.html:419-420`
- Modify: `site/styles.css:4`

- [ ] **Step 1: 写入界面合同失败检查**

在 `check_company_composer_contract.mjs` 中读取 `site/styles/records.css`，增加：

```js
assert.match(composer, /buildingSources/);
assert.match(composer, /company-composer-building-overlap/);
assert.match(composer, /company-composer-building-coverage/);
assert.match(read("site/styles/records.css"), /\.company-composer-building-overlap/);
assert.match(index, /app\/company-composer-core\.js\?v=20260819-company-overlap1/);
assert.match(index, /app\/company-composer\.js\?v=20260819-company-overlap1/);
assert.match(styles, /styles\/records\.css\?v=20260819-company-overlap1/);
```

- [ ] **Step 2: 写入原版浏览器失败检查**

不要依赖图片墙前两项。先清除当前选择，再选择固定覆盖港口的 `company_a_markwald_and_company` 与 `company_ap_moller`，检查：

```js
const overlap = await page.evaluate(() => {
  const link = document.querySelector("[data-company-composer-building-coverage='building_port']");
  return {
    links: document.querySelectorAll("[data-company-composer-building-coverage='building_port']").length,
    badge: link?.querySelector(".company-composer-building-overlap")?.textContent || "",
    title: link?.getAttribute("title") || "",
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
});
assert.equal(overlap.links, 1, "overlapping coverage keeps one building icon");
assert.equal(overlap.badge, "×2");
assert.match(overlap.title, /马克沃尔德/);
assert.match(overlap.title, /穆勒/);
assert.equal(overlap.overflow, false);
```

再选择 `company_a_markwald_and_company` 与 `company_ansaldo`，点击前者的 `building_tooling_workshop` 扩展，确认角标 `×2`；再次点击取消后，确认该建筑没有 `.company-composer-building-overlap`。

- [ ] **Step 3: 运行合同与浏览器检查并确认缺少标记而失败**

Run:

```powershell
node scripts/check_company_composer_contract.mjs
node scripts/check_company_composer_browser.mjs
```

Expected: 合同检查首先因缺少 `company-composer-building-overlap` 失败；完成合同所需结构但尚未实现行为时，浏览器检查因角标为空失败。

- [ ] **Step 4: 实现来源文本和统一建筑图标渲染**

将 `companyComposerLinkedBuilding` 扩展为接收 `summary`：

```js
function companyComposerBuildingSources(summary, key) {
  return (summary?.buildingSources?.[key] || []).map((companyKey) => byCompany.get(companyKey)).filter(Boolean);
}

function companyComposerLinkedBuilding(key, summary) {
  const label = companyComposerBuildingLabel(key);
  const sources = companyComposerBuildingSources(summary, key);
  const sourceLabels = sources.map(companyComposerCompanyLabel);
  const title = sourceLabels.length > 1
    ? `${label}；${companyComposerT("board.company.composer.coveredBy", "覆盖公司：{companies}", { companies: sourceLabels.join("、") })}`
    : label;
  const overlap = sources.length > 1 ? `<span class="company-composer-building-overlap" aria-hidden="true">×${sources.length}</span>` : "";
  return `<a class="company-composer-building-link" data-company-composer-building-coverage="${escapeHtml(key)}" href="#/building/${encodeURIComponent(key)}" title="${escapeHtml(title)}">${companyComposerBuildingIcon(key)}${overlap}</a>`;
}
```

固定建筑映射改为：

```js
const fixedBuildings = fixedBuildingKeys.map((key) => companyComposerLinkedBuilding(key, summary)).join("");
```

扩展选项仍是未提交的选择控件，不显示重复角标；当前已经选择的扩展会出现在固定建筑合并列表中，由同一建筑图标标明来源。

- [ ] **Step 5: 添加角标样式**

```css
.company-composer-building-link {
  position: relative;
}

.company-composer-building-overlap {
  position: absolute;
  top: -.18rem;
  right: -.18rem;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 .2rem;
  border: 1px solid rgba(255, 240, 196, .8);
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: .7rem;
  font-weight: 800;
  line-height: 1.1rem;
  text-align: center;
  pointer-events: none;
}
```

- [ ] **Step 6: 增加中英文界面文本并更新缓存标识**

在 `site/locales/ui.zh-Hans.js` 与 `site/locales/ui.en.js` 的组合器条目中增加：

```js
"board.company.composer.coveredBy": "覆盖公司：{companies}",
```

```js
"board.company.composer.coveredBy": "Covered by: {companies}",
```

将 `site/index.html` 中组合器核心及界面脚本标识改为 `20260819-company-overlap1`；将 `site/styles.css` 的 `records.css` 导入标识改为相同值，并同步更新合同断言。

- [ ] **Step 7: 运行合同及原版浏览器检查并确认通过**

Run:

```powershell
node scripts/check_company_composer_core.mjs
node scripts/check_company_composer_contract.mjs
node scripts/check_company_composer_browser.mjs
```

Expected: 三项均通过；浏览器报告包含 1440×1000 和 390×844，且 `bodyOverflow: false`。

- [ ] **Step 8: 提交界面、样式、本地化与检查**

```powershell
git add -- site/app/company-composer.js site/styles/records.css site/styles.css site/index.html site/locales/ui.zh-Hans.js site/locales/ui.en.js scripts/check_company_composer_contract.mjs scripts/check_company_composer_browser.mjs
git commit -m "feat: mark overlapping company building coverage"
```

### Task 3: Victorian Century 同步与验证

**Files:**
- Modify: `scripts/check_victorian_century_standalone_site.mjs:80-125`
- Modify: `scripts/check_victorian_century_company_tools_browser.mjs:39-57`
- Generated: `Victorian Century Database/app/company-composer-core.js`
- Generated: `Victorian Century Database/app/company-composer.js`
- Generated: `Victorian Century Database/styles/records.css`
- Generated: `site/vc/app/company-composer-core.js`
- Generated: `site/vc/app/company-composer.js`
- Generated: `site/vc/styles/records.css`

- [ ] **Step 1: 更新 VC 静态缓存检查**

将 standalone 与 published HTML 的组合器断言改为 `20260819-company-overlap1`，并继续保留 `expectedCompanyToolFiles` 对核心、界面和样式逐字节一致性的检查。

- [ ] **Step 2: 写入 VC 浏览器重复覆盖检查**

在奔驰公司检查完成后清除选择，选择 VC 中也存在的 `company_a_markwald_and_company` 与 `company_ap_moller`，读取 `building_port`：

```js
const overlap = await page.evaluate(() => {
  const link = document.querySelector("[data-company-composer-building-coverage='building_port']");
  return {
    badge: link?.querySelector(".company-composer-building-overlap")?.textContent || "",
    title: link?.title || "",
  };
});
assert.equal(overlap.badge, "×2", `${output.name} must mark shared port coverage`);
assert.match(overlap.title, /马克沃尔德/);
assert.match(overlap.title, /穆勒/);
```

- [ ] **Step 3: 运行 VC 检查并确认旧输出失败**

Run:

```powershell
node scripts/check_victorian_century_standalone_site.mjs
node scripts/check_victorian_century_company_tools_browser.mjs
```

Expected: FAIL，旧 VC 输出仍使用旧缓存或没有 `×2`。

- [ ] **Step 4: 重新生成两份 VC 输出**

Run:

```powershell
node scripts/build_victorian_century_site.mjs --source site --target "Victorian Century Database" --publish-target site/vc --vc-database database/victorian_century --skip-vc-assets
```

Expected: `victorian_century_site_build: ok`，`source: site`，`target: Victorian Century Database`，`publish_target: site/vc`。

- [ ] **Step 5: 运行 VC 静态和浏览器检查**

Run:

```powershell
node scripts/check_victorian_century_standalone_site.mjs
node scripts/check_victorian_century_company_tools_browser.mjs
node scripts/check_victorian_century_browser.mjs "file:///D:/Bot/Vic3/Victoria3_DB/Victorian%20Century%20Database/index.html" building goods
node scripts/check_victorian_century_browser.mjs "file:///D:/Bot/Vic3/Victoria3_DB/site/vc/index.html" building goods
```

Expected: 四项均通过；两份公司工具报告均为 `companies: 231`、`solverBuildings: 48`，并确认港口角标为 `×2`。

- [ ] **Step 6: 提交 VC 检查脚本**

`Victorian Century Database/` 和 `site/vc/` 是本地生成输出，按现有忽略规则不单独提交。提交检查脚本：

```powershell
git add -- scripts/check_victorian_century_standalone_site.mjs scripts/check_victorian_century_company_tools_browser.mjs
git commit -m "test: verify VC company coverage markers"
```

### Task 4: 工作记录与最终回归

**Files:**
- Modify: `docs/worklog/2026-08-18-company-building-composer.md`
- Modify: `WORKLOG.md`

- [ ] **Step 1: 更新详细记录**

在 `docs/worklog/2026-08-18-company-building-composer.md` 增加“重复覆盖标记”段落，写明固定建筑与当前扩展计入统计、未选扩展不计入、`×N` 角标、悬停公司名称、原版与两份 VC 的实际检查结果。

- [ ] **Step 2: 更新根索引**

在 `WORKLOG.md` 当前状态加入一条简短记录，指向详细记录，并明确本地完成、推送状态和公开部署状态。

- [ ] **Step 3: 运行完整回归**

Run:

```powershell
node scripts/check_company_composer_core.mjs
node scripts/check_company_composer_contract.mjs
node scripts/check_company_composer_browser.mjs
node scripts/check_company_solver_core.mjs
node scripts/check_company_solver_worker.mjs
node scripts/check_company_solver_contract.mjs
node scripts/check_company_solver_browser.mjs
node scripts/check_victorian_century_standalone_site.mjs
node scripts/check_victorian_century_main_entry.mjs
node scripts/check_victorian_century_company_tools_browser.mjs
node scripts/check_publish_bundle.mjs
git diff --check
```

Expected: 所有 Node.js 检查退出码为 0；发布清单仍检查 1636 个文件和 1.13.10、1.13.9；`git diff --check` 无空白错误。

- [ ] **Step 4: 核对工作树并提交记录**

Run:

```powershell
git status --short --branch
git diff --stat -- WORKLOG.md docs/worklog/2026-08-18-company-building-composer.md site/app/company-composer-core.js site/app/company-composer.js site/styles/records.css site/styles.css site/index.html scripts/check_company_composer_core.mjs scripts/check_company_composer_contract.mjs scripts/check_company_composer_browser.mjs scripts/check_victorian_century_standalone_site.mjs scripts/check_victorian_century_company_tools_browser.mjs
git add -- WORKLOG.md docs/worklog/2026-08-18-company-building-composer.md
git commit -m "docs: record company coverage markers"
```

只处理本计划列出的文件；保留工作区中其余既有修改和未跟踪文件。
