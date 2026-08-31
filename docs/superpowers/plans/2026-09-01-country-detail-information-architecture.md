# 国家详情信息架构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将国家详情改造成“固定概览＋八个二级标签＋利益集团和风味三级标签”的可恢复、可验证页面，并补充 1836 年开局科技、法律和外交关系数据。

**Architecture:** 保留现有国家详情路由和共享详情面板，以查询参数保存当前二级、三级标签。先把已有国家字段迁移到标签视图，再扩展数据提取层提供开局科技、法律和外交字段；利益集团复用当前风味规则数据，风味内容复用国家内容关联数据。所有共享前端通过现有构建脚本同步到 Victorian Century 独立目录和 `site/vc`。

**Tech Stack:** 原生 JavaScript、CSS、Node.js `assert`/静态合同、现有数据提取脚本、哈希路由、Chrome 调试协议浏览器检查。

**Spec:** `docs/superpowers/specs/2026-09-01-country-detail-information-architecture-design.md`

## Global Constraints

- 国家详情顶部始终显示国家类型、国家位阶、首都、主流文化、宗教和标准色。
- 二级标签顺序固定为【变体】、【社会】、【地区】、【科技】、【法律】、【外交】、【利益集团】、【风味】；默认打开【变体】。
- 人口模块只预留位置，本轮不增加人口统计或推算数据，不渲染空白占位卡片。
- 部队颜色不放入国家概览，开局州数量只放在【地区】内容内。
- 【利益集团】使用八个三级图标标签；开局生效风味默认展开，全部潜在风味默认收起。
- 【风味】使用日志、事件、决议三级标签。
- 开局科技、法律和外交关系只接受 1836 年历史或明确外交定义数据，不从文化、地区或标题推断。
- 主站源码位于 `site/`；Victorian Century 独立目录和 `site/vc` 由现有构建流程生成，不作为独立源码维护。
- 保留现有深蓝、灰黑、暗金和米色配色，不重做利益集团独立板块和宗教独立板块。

---

### Task 1: 建立国家详情标签状态与固定概览

**Files:**
- Modify: `site/app/runtime.js` — 增加国家详情二级标签、利益集团三级标签和风味三级标签状态。
- Modify: `site/app/ui.js` — 解析和生成国家详情查询参数，处理无效标签回退和返回状态。
- Modify: `site/app/presentation.js` — 将国家详情拆为固定概览、标签栏和当前标签内容。
- Modify: `site/styles/country.css` 或新建 `site/styles/country-detail.css` — 定义国家详情标签栏、概览卡片和窄屏横向滚动。
- Modify: `site/styles.css` — 接入新增样式文件和缓存版本。
- Test: `scripts/check_country_detail_tabs.mjs` — 静态合同。
- Test: `scripts/check_country_detail_tabs_browser.mjs` — 主站桌面与窄屏浏览器检查。

**Interfaces:**
- Produces `state.countryDetailTab`, `state.countryDetailSubtab` 和 `state.countryDetailFlavorTab` 三个状态字段。
- Produces `countryDetailRoute(tag, tab, subtab)` 和 `parseCountryDetailTab(query)` 两个路由辅助函数。
- Produces `countryDetailTabs(country)`、`countryDetailOverview(country)` 和 `countryDetailTabContent(country, tab)` 三个展示辅助函数。

- [ ] **Step 1: Write the failing static and browser tests.**

  在静态检查中断言八个标签按固定顺序出现、默认标签为 `variants`、概览不包含部队颜色和开局州数量；在浏览器检查中访问 `#/country/CHI`，断言概览显示国家类型、首都、主流文化、宗教和标准色，点击【社会】后只显示社会内容，刷新后仍停留在【社会】。

- [ ] **Step 2: Run the tests to verify the new contract fails.**

  运行：

  ```powershell
  node scripts/check_country_detail_tabs.mjs
  node scripts/check_country_detail_tabs_browser.mjs
  ```

  预期：静态检查因缺少标签状态和国家详情标签结构失败，浏览器检查因国家详情仍为连续单页失败。

- [ ] **Step 3: Implement the minimum tab shell.**

  在 `runtime.js` 初始化三个空标签状态；在 `ui.js` 将 `tab`、`ig` 和 `flavor` 查询参数限制在固定枚举内，无效值回退到 `variants`；在 `presentation.js` 把现有基础字段放入固定概览，把变体、社会和地区的现有内容映射到标签内容函数，并为【利益集团】、【外交】、【风味】预留稳定容器和状态接口，具体内容由后续任务接入。初始【社会】保留文化、宗教和传承、语言、传统，插入人口模块的内部预留标记但不渲染空卡片。

  概览固定显示：

  ```js
  ["countryType", "tier", "capital", "primaryCultures", "religion", "standardColor"]
  ```

  【变体】默认承载 `countryFlagVariantSection(country)`、`dynamicNameList(country)` 和 `dynamicMapColorList(country)`；【地区】承载整合计算器入口、首都所在地区、开局地区、成立、释放和特殊机制；其余内容按规格映射到对应标签。

- [ ] **Step 4: Run the focused tests and browser checks.**

  运行上述两个检查，并补充 `node scripts/check_ui_ideology_contracts.mjs`、`node scripts/check_right_panel_layout.mjs` 和 `git diff --check`。预期国家详情标签切换、查询参数刷新恢复和窄屏横向滚动通过；若旧的样式缓存断言失败，只更新与本次国家详情样式入口直接相关的合同，不修改无关板块断言。

- [ ] **Step 5: Commit the task.**

  ```powershell
  git add site/app/runtime.js site/app/ui.js site/app/presentation.js site/styles/country-detail.css site/styles.css scripts/check_country_detail_tabs.mjs scripts/check_country_detail_tabs_browser.mjs
  git commit -m "feat: add country detail tab shell"
  ```

### Task 2: 接入利益集团三级图标标签和全部潜在风味

**Files:**
- Modify: `site/app/runtime.js` — 保存当前利益集团三级标签。
- Modify: `site/app/ui.js` — 保存和恢复 `ig` 查询参数。
- Modify: `site/app/presentation.js` — 生成国家详情中的利益集团图标条和当前集团内容。
- Modify: `site/app/boards.js` — 抽取或共享利益集团风味变体归一化逻辑，保证国家详情能列出全部潜在风味。
- Modify: `site/app/components.js` — 复用利益集团图标、特质和意识形态展示辅助函数。
- Modify: `site/styles/country-detail.css` — 增加图标选择条、选中状态和风味折叠区样式。
- Test: `scripts/check_country_detail_interest_groups.mjs` — 静态和数据合同。
- Test: `scripts/check_country_detail_interest_groups_browser.mjs` — 浏览器交互检查。

**Interfaces:**
- Consumes `country.interestGroups`、`interestGroupVariants(group)`、`interestGroupFlavorIdeologies(group, flavor)` 和现有利益集团本地化资源。
- Produces `countryInterestGroupTabs(country)`，返回八个 `{ key, label, icon, hasStartingFlavor }` 项目。
- Produces `countryInterestGroupPanel(group)`，返回当前集团的开局生效区和潜在风味折叠区。

- [ ] **Step 1: Write the failing tests.**

  使用中国和英国国家数据，断言国家详情包含八个利益集团选择项；断言切换地主、军方和虔信者后当前面板变化；断言有开局数据的集团默认展开；断言潜在风味数量不因未满足当前条件而删除，且潜在区的 `details` 默认关闭。

- [ ] **Step 2: Run the tests and observe the failure.**

  运行：

  ```powershell
  node scripts/check_country_detail_interest_groups.mjs
  node scripts/check_country_detail_interest_groups_browser.mjs
  ```

  预期：当前国家详情没有三级图标标签，静态检查和浏览器检查失败。

- [ ] **Step 3: Implement the smallest reusable presentation layer.**

  使用固定顺序 `ig_armed_forces`、`ig_devout`、`ig_industrialists`、`ig_intelligentsia`、`ig_landowners`、`ig_petty_bourgeoisie`、`ig_rural_folk`、`ig_trade_unions`。图标按钮使用现有利益集团图标资源，设置 `role="tab"`、`aria-selected`、`tabindex` 和 `data-country-interest-group`。当前集团面板只显示一个，开局生效区域直接展开，潜在风味使用：

  ```html
  <details class="country-interest-group-potential">
    <summary>潜在风味</summary>
    <!-- all normalized variants for this country and group -->
  </details>
  ```

  潜在风味每项显示风味名称、触发条件、特质变化、意识形态变化和来源。缺少当前集团数据时保留图标并标记不可用，点击后显示该集团没有国家专属风味的状态。

- [ ] **Step 4: Run the focused contracts and keyboard/browser checks.**

  运行 Task 2 两个检查、`node scripts/check_interest_group_board.mjs`、`node scripts/check_interest_group_board_browser.mjs` 和 `git diff --check`。确认利益集团独立板块没有被国家详情样式覆盖。

- [ ] **Step 5: Commit the task.**

  ```powershell
  git add site/app/runtime.js site/app/ui.js site/app/presentation.js site/app/boards.js site/app/components.js site/styles/country-detail.css scripts/check_country_detail_interest_groups.mjs scripts/check_country_detail_interest_groups_browser.mjs
  git commit -m "feat: organize country interest group flavors"
  ```

### Task 3: 增加 1836 年开局科技与法律数据

**Files:**
- Modify: `scripts/extract_vic3_countries.mjs` — 从 1836 年历史文件提取国家初始科技和法律。
- Modify: `scripts/build_wiki.mjs` — 将结构化字段投影到网页国家数据。
- Modify: `site/app/presentation.js` — 渲染科技和法律标签。
- Modify: `site/app/components.js` — 复用科技、法律概念标签。
- Modify: `site/styles/country-detail.css` — 增加科技、法律分组卡片样式。
- Test: `scripts/check_country_starting_tech_laws.mjs` — 数据提取合同。
- Test: `scripts/check_country_starting_tech_laws_browser.mjs` — 浏览器检查。

**Interfaces:**
- Produces database country fields `starting_technologies` 和 `starting_laws`，两者均为带 `key` 和 `loc` 的稳定引用数组。
- Produces site country fields `startingTechnologies` 和 `startingLaws`。
- Produces `countryStartingTechHtml(country)` 和 `countryStartingLawHtml(country)`。

- [ ] **Step 1: Write fixtures and failing extraction tests.**

  以中国、英国、日本和一个非 1836 年开局国家为夹具，断言开局存在国家的初始科技和法律来自历史文件，非开局国家的两个数组为空并保留状态字段。

- [ ] **Step 2: Run extraction tests to verify missing fields.**

  运行：

  ```powershell
  node scripts/check_country_starting_tech_laws.mjs
  ```

  预期：当前数据库国家记录没有这两个字段，检查失败。

- [ ] **Step 3: Implement the history readers and site projection.**

  在提取脚本中读取 `common/history/countries` 的 `set_technology`、`set_law` 或同等 1836 年初始赋值节点，只接受国家历史文件中的国家作用域；不从国家定义或全局科技、法律列表推断。国家不在开局时写入空数组和 `starting_content_status: "not_at_start"`。网页投影保留引用的 `loc`，通过现有 `entityText`、`technologyPill` 和 `lawPill` 渲染。

- [ ] **Step 4: Rebuild the base data and run checks.**

  运行：

  ```powershell
  node scripts/extract_vic3_countries.mjs --game-path "D:\\SteamLibrary\\steamapps\\common\\Victoria 3" --version 1.13.11 --out output/vic3_1.13.11 --database database/vic3_1.13.11 --dataset-name "Victoria 3"
  node scripts/build_wiki.mjs --database database/vic3_1.13.11 --source database/vic3_1.13.11/index.json --out site/versions/1.13.11
  node scripts/check_country_starting_tech_laws.mjs
  node scripts/check_country_starting_tech_laws_browser.mjs
  ```

  预期中国、英国、日本显示稳定的开局科技和法律；非开局国家显示明确标注，不显示伪造列表。

- [ ] **Step 5: Commit the task.**

  ```powershell
  git add scripts/extract_vic3_countries.mjs scripts/build_wiki.mjs site/app/presentation.js site/app/components.js site/styles/country-detail.css database/vic3_1.13.11 site/versions/1.13.11 scripts/check_country_starting_tech_laws.mjs scripts/check_country_starting_tech_laws_browser.mjs
  git commit -m "feat: expose country starting technologies and laws"
  ```

### Task 4: 增加开局外交关系标签

**Files:**
- Modify: `scripts/extract_vic3_countries.mjs` — 提取开局附属关系、预设条约和宿敌等关系。
- Modify: `scripts/build_wiki.mjs` — 投影外交关系数据到网页国家记录。
- Modify: `site/app/presentation.js` — 渲染外交标签。
- Modify: `site/app/components.js` — 提供国家关系标签和对象链接。
- Modify: `site/styles/country-detail.css` — 增加外交关系分组卡片样式。
- Test: `scripts/check_country_starting_diplomacy.mjs` — 数据合同。
- Test: `scripts/check_country_starting_diplomacy_browser.mjs` — 浏览器检查。

**Interfaces:**
- Produces database country field `starting_diplomacy` with objects `{ type, target_tag, subject_type, source_file, source_line, loc }`.
- Produces site country field `startingDiplomacy` with localized target and type references.
- Produces `countryDiplomacyHtml(country)`.

- [ ] **Step 1: Write failing fixtures for known relationships.**

  以一个开局附属国、一个有开局宗主国的国家和一个没有关系的国家为夹具，断言附属类型、宗主国和空状态；同时检查 `starting_diplomacy` 不包含 1836 年之后的动态外交。

- [ ] **Step 2: Run the data contract and observe failure.**

  运行：

  ```powershell
  node scripts/check_country_starting_diplomacy.mjs
  ```

  预期：当前只有 `starting_subject`，没有统一外交关系数组、条约和宿敌字段，检查失败。

- [ ] **Step 3: Implement source-specific diplomacy extraction.**

  先读取 `common/history/diplomacy` 中的开局关系，保留现有 `starting_subject` 的兼容字段；再读取版本中明确写入的开局条约和宿敌定义。每条关系保留类型、对象国家、附属类型和来源行号。没有明确源记录时不生成关系。

- [ ] **Step 4: Render and verify diplomacy states.**

  外交标签按附属关系、条约、宿敌和其他固定关系分组；对象国家使用国家概念标签，类型使用界面本地化。非开局国家显示“非 1836 年开局国家”，无关系国家显示“没有记录的开局外交关系”。运行 Task 4 两个检查、`node scripts/check_starting_subject_relationships.mjs` 和 `git diff --check`。

- [ ] **Step 5: Commit the task.**

  ```powershell
  git add scripts/extract_vic3_countries.mjs scripts/build_wiki.mjs site/app/presentation.js site/app/components.js site/styles/country-detail.css scripts/check_country_starting_diplomacy.mjs scripts/check_country_starting_diplomacy_browser.mjs
  git commit -m "feat: add country starting diplomacy"
  ```

### Task 5: 接入风味三级标签

**Files:**
- Modify: `site/app/runtime.js` — 保存风味三级标签。
- Modify: `site/app/ui.js` — 解析 `flavor` 查询参数。
- Modify: `site/app/presentation.js` — 渲染日志、事件、决议三级标签。
- Modify: `site/app/content-country-links.js` — 复用国家反向关联数据。
- Modify: `site/styles/country-detail.css` — 增加风味三级标签和内容卡片样式。
- Test: `scripts/check_country_detail_flavor_tabs.mjs` — 静态合同。
- Test: `scripts/check_country_detail_flavor_tabs_browser.mjs` — 浏览器检查。

**Interfaces:**
- Produces `countryFlavorTabs(country)` returning `{ key, label, count }[]` for `journal`, `event`, `decision`.
- Produces `countryFlavorTabContent(country, flavorTab)` returning only the selected content category.

- [ ] **Step 1: Write failing tests.**

  以有日志、事件和决议关联的国家为夹具，断言三个三级标签、数量和单类内容渲染；以没有某类内容的国家断言标签保留且显示空状态；刷新 `#/country/CHI?tab=flavor&flavor=event` 后恢复事件标签。

- [ ] **Step 2: Run tests to confirm the old single stream fails.**

  运行：

  ```powershell
  node scripts/check_country_detail_flavor_tabs.mjs
  node scripts/check_country_detail_flavor_tabs_browser.mjs
  ```

- [ ] **Step 3: Implement flavor tabs and content cards.**

  使用现有国家内容反向索引，按照日志、事件、决议生成数量标签。卡片显示标题、内容组、来源和现有详情链接，不复制全局板块筛选器。三级标签状态写入 `flavor` 查询参数，回退逻辑只允许三个固定值。

- [ ] **Step 4: Verify content navigation and state restoration.**

  运行 Task 5 检查、`node scripts/check_global_content_search.mjs`、`node scripts/check_victorian_century_content_country_contract.mjs` 和 `git diff --check`。确认从国家详情进入内容详情再返回时保留国家标签和风味三级标签。

- [ ] **Step 5: Commit the task.**

  ```powershell
  git add site/app/runtime.js site/app/ui.js site/app/presentation.js site/app/content-country-links.js site/styles/country-detail.css scripts/check_country_detail_flavor_tabs.mjs scripts/check_country_detail_flavor_tabs_browser.mjs
  git commit -m "feat: add country flavor tabs"
  ```

### Task 6: 三套输出同步、完整回归与发布前检查

**Files:**
- Modify: `scripts/build_victorian_century_site.mjs` only if the existing sync requires a new shared file or cache version.
- Modify: `scripts/check_shared_layout_parity.mjs` — 纳入国家详情新增共享文件。
- Modify: `scripts/check_publish_bundle.mjs` — 检查三套输出中的国家详情资源和数据字段。
- Modify: `WORKLOG.md` — 添加简短索引记录。
- Create: `docs/worklog/2026-09-01-country-detail-information-architecture.md` — 记录实现、验证、提交和发布状态。
- Generated: `Victorian Century Database/` and `site/vc/` — 通过构建脚本同步，不直接编辑。

**Interfaces:**
- Consumes all outputs from Tasks 1–5.
- Produces synchronized main site, Victorian Century standalone site and `site/vc` output with identical shared app/style hashes.

- [ ] **Step 1: Run the complete focused validation set before rebuilding VC.**

  ```powershell
  node scripts/check_country_detail_tabs.mjs
  node scripts/check_country_detail_interest_groups.mjs
  node scripts/check_country_starting_tech_laws.mjs
  node scripts/check_country_starting_diplomacy.mjs
  node scripts/check_country_detail_flavor_tabs.mjs
  node scripts/check_ui_ideology_contracts.mjs
  node scripts/check_shared_layout_parity.mjs
  git diff --check
  ```

- [ ] **Step 2: Rebuild Victorian Century outputs.**

  ```powershell
  node scripts/build_victorian_century_site.mjs --source site --target "Victorian Century Database" --publish-target site/vc --vc-database database/victorian_century --skip-vc-assets
  ```

- [ ] **Step 3: Run main, standalone and published browser checks.**

  Use the existing Chrome debugging scripts with separate current-workspace preview roots for `site/`, `Victorian Century Database/` and `site/vc/`. Check desktop and narrow layouts for China, Britain, Japan and a non-start country. Assert no horizontal overflow, no console errors, eight interest-group icons, three flavor subtabs, query-state restoration, and the non-start markers.

- [ ] **Step 4: Run release checks.**

  ```powershell
  node scripts/check_shared_layout_parity.mjs
  node scripts/check_publish_bundle.mjs
  node scripts/check_victorian_century_standalone_site.mjs
  git diff --check
  git status --short --branch
  ```

- [ ] **Step 5: Record the implementation handoff.**

  Update `WORKLOG.md` with the final local commit list, generated output status, verification commands and the fact that remote push and public deployment remain separate actions. Write the detailed record under `docs/worklog/2026-09-01-country-detail-information-architecture.md`.

- [ ] **Step 6: Commit and hand off for user review.**

  ```powershell
  git add scripts docs/worklog/2026-09-01-country-detail-information-architecture.md WORKLOG.md site/app site/styles site/versions
  git commit -m "feat: reorganize country detail information"
  ```

  Do not push or deploy automatically. Report local commit, remote state and public deployment state separately.
