# 主流文化条件路径国家详情 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在原版和 Victorian Century 国家详情中展示可确定国家归属的主流文化条件路径、互斥路线、替换关系和来源坐标。

**Architecture:** `scripts/primary_culture_expansions.mjs` 保持审计结果的权威性，在国家记录中新增独立的 `conditional_primary_culture_paths` 字段。`scripts/build_wiki.mjs` 将该字段变换为前端使用的 `primaryCultureConditionalPaths`；`site/app/presentation.js` 合并直接路径、条件路径和替换路径，在国家详情的开局主流文化之后渲染可折叠条目。顶层条件记录只有携带 `country_tags` 时才进入国家数据；无具体国家标签的记录继续只留在审计文件中。

**Tech Stack:** 原生 JavaScript、Node.js `assert`/`vm` 契约脚本、无头 Chrome 浏览器检查、现有原版与 Victorian Century 静态构建脚本。

---

### Task 1: 为条件路径投影建立失败的数据契约

**Files:**
- Modify: `scripts/check_primary_culture_expansion_data.mjs:17-129, 143-218`
- Test fixture: the embedded countries and events in `scripts/check_primary_culture_expansion_data.mjs`

- [ ] **Step 1: 为三个投影来源写出失败断言**

在 `build_wiki.mjs` 已输出的 `countriesByTag` 后添加断言。法国的加泰罗尼亚路径必须位于 `primaryCultureConditionalPaths`，且保留文化、本土条件、法国来源条件、脚本按钮、文件和行号；安第斯联邦的普拉特文化必须同时投影至 `GCO`、`PBC`、`PLT`；`PLT` 的瓜拉尼路径必须保留 `was_formed_from_any: ["PRG"]`。使用下列期望结构：

```js
const franceCatalan = countriesByTag.get("FRA").primaryCultureConditionalPaths
  .find((item) => item.culture === "catalan");
assert.deepEqual(franceCatalan, {
  culture: "catalan",
  eligible_when: {
    country_or_was_formed_from_any: ["FRA"],
    homeland_culture: "catalan",
  },
  content_type: "scripted",
  content_id: "scripted_button:je_vernacular_policy_accept_catalan_button",
  effect_kind: "scripted_button",
  source_file: "common/scripted_buttons/06_vernacular_buttons.txt",
  source_line: 80,
});
assert.deepEqual(
  ["GCO", "PBC", "PLT"].map((tag) => countriesByTag.get(tag).primaryCultureConditionalPaths
    .find((item) => item.culture === "platinean")?.eligible_when),
  [{ was_formed_from_any: ["PLT"] }, { was_formed_from_any: ["PLT"] }, { was_formed_from_any: ["PLT"] }],
);
assert.deepEqual(
  countriesByTag.get("PLT").primaryCultureConditionalPaths.find((item) => item.culture === "guarani")?.eligible_when,
  { was_formed_from_any: ["PRG"] },
);
assert.equal(countriesByTag.get("CHI")?.primaryCultureConditionalPaths?.length || 0, 0);
```

- [ ] **Step 2: 在夹具中提供安第斯联邦事件**

在 `events` 数组加入 `andean_federation.2`，使顶层条件记录有实际来源可投影：

```js
event(
  "andean_federation.2",
  "events/brazil/gran_colombia.txt",
  378,
  "option = { if = { add_primary_culture = cu:platinean } }",
),
```

保留原有义和团事件夹具；它将证明没有 `country_tags` 的条件记录不得进入 `CHI` 详情数据。

- [ ] **Step 3: 运行测试确认失败**

运行：

```powershell
node scripts/check_primary_culture_expansion_data.mjs
```

预期：测试在读取 `primaryCultureConditionalPaths` 时失败，原因是构建数据尚未投影条件路径，而不是夹具缺少文化或国家。

- [ ] **Step 4: 提交失败测试基线**

```powershell
git add scripts/check_primary_culture_expansion_data.mjs
git commit -m "test: define conditional primary culture projection"
```

### Task 2: 生成并投影可确定归属的条件路径

**Files:**
- Modify: `scripts/primary_culture_expansions.mjs:72-187, 273-295, 426-512`
- Modify: `scripts/build_wiki.mjs:283-305, 584-628`
- Test: `scripts/check_primary_culture_expansion_data.mjs`

- [ ] **Step 1: 在审计定义中标注法国和阿富汗的结构化条件**

给法国五条方言政策路径增加相同的国家来源字段和各自的本土字段。方言政策的完整已知要求必须写入结构化记录：拥有对应文化本土、已有对应文化人口、已选择整合变量、国家为法国或由法国形成、平均文化接纳度至少为 `acceptance_status_5`，以及满足“制造业鼓励法令＋10 级城市中心＋3 级大学或艺术学院”或“至少两个社会流动法令州，且每州有 5 级城市中心及大学或艺术学院”的任一发展条件。页面将把两条发展条件合并为“满足方言政策的城市建设与法令条件”，并保留脚本文件和行号供查阅。加泰罗尼亚条目使用：

```js
{
  country: "FRA",
  culture: "catalan",
  content_id: "scripted_button:je_vernacular_policy_accept_catalan_button",
  effect_kind: "scripted_button",
  source_file: "common/scripted_buttons/06_vernacular_buttons.txt",
  source_line: 80,
  eligible_when: {
    country_or_was_formed_from_any: ["FRA"],
    homeland_culture: "catalan",
    culture_present: "catalan",
    requires_variable: "chose_integration_var",
    minimum_culture_acceptance: "acceptance_status_5",
    one_of: ["vernacular_industrial_development", "vernacular_social_mobility"],
  },
},
```

将同一结构分别写入 `breton`、`francoprovencal`、`occitan`、`wallonian`，仅替换 `homeland_culture` 与 `culture_present` 的文化键。给阿富汗来源路径增加 `has_journal_entry: "je_unify_afghanistan"` 和 `was_formed_from_any`：坤都士为 `KUN`，迈马纳的乌兹别克和土库曼为 `MAI`，喀布尔的科文化为 `KAF`。南非路径保持现有互斥选择组；它只显示已审计的互斥选择与来源，不把未结构化的完整按钮可用条件伪装为无条件获得。

- [ ] **Step 2: 让审计记录保留条件，并建立国家投影集合**

在 `makeReviewedPath` 中保留审计定义的 `eligible_when`：

```js
function makeReviewedPath(scripted) {
  return {
    culture: scripted.culture,
    content_type: scripted.effect_kind === "on_action" ? "on_action" : "scripted",
    content_id: scripted.content_id,
    effect_kind: scripted.effect_kind,
    source_file: scripted.source_file,
    source_line: scripted.source_line,
    ...(scripted.eligible_when ? { eligible_when: scripted.eligible_when } : {}),
  };
}
```

声明 `conditionalPathsByCountry`。在所有内容记录已写入 `conditionalEffects` 后，将每条有 `country_tags` 的顶层记录转成国家条目；无 `country_tags` 的记录不进入该映射：

```js
const conditionalPathsByCountry = new Map();

for (const conditional of conditionalEffects) {
  for (const tag of conditional.country_tags || []) {
    addConditionalPath(conditionalPathsByCountry, tag, {
      culture: conditional.added_culture,
      ...(conditional.removed_culture ? { removed_culture: conditional.removed_culture } : {}),
      eligible_when: conditional.eligible_when,
      content_type: conditional.content_type,
      content_id: conditional.content_id,
      source_file: conditional.source_file,
      source_line: conditional.source_line,
    });
  }
}
```

将 `conditionalPathsByCountry.keys()` 纳入 `countryRecords` 的国家集合。`buildCountryRecord` 新增 `rawConditionalPaths` 参数，并将两类记录合并为 `conditional_primary_culture_paths`：一类是带 `eligible_when` 的已审计路径，另一类是带明确国家标签的顶层条件记录。`paths`、`added_primary_cultures`、`maximum_primary_cultures` 和 `maximum_primary_culture_sets` 保持既有计算，避免改变已发布的最大可达集合语义。

- [ ] **Step 3: 添加稳定去重和排序**

新增 `addConditionalPath`、`uniqueConditionalPaths` 与 `compareConditionalPath`。比较键必须包含 `culture`、`removed_culture`、`eligible_when`、`content_type`、`content_id`、`source_file`、`source_line`，防止同一来源重复投影，同时保留同一文化的不同来源路径。`buildCountryRecord` 的保留条件扩展为 `conditionalPaths.length > 0`。

- [ ] **Step 4: 将新字段带入站点国家数据**

在 `flattenDatabaseCountry` 中读取并写出新字段：

```js
const primaryCultureConditionalPaths = primaryCultureExpansion?.conditional_primary_culture_paths || [];

return {
  // existing fields
  primaryCultureExpansionPaths,
  primaryCultureConditionalPaths,
  primaryCultureReplacementPaths,
  primaryCultureOptionGroups,
  hasPrimaryCultureExpansions: Boolean(
    primaryCultureExpansionPaths.length
    || primaryCultureConditionalPaths.length
    || primaryCultureReplacementPaths.length,
  ),
};
```

保持小驼峰字段名与现有国家数据一致。

- [ ] **Step 5: 运行数据契约确认通过**

运行：

```powershell
node scripts/check_primary_culture_expansion_data.mjs
```

预期：输出 `primary culture expansion data contract passed`，并同时证明法国、安第斯联邦、巴拉圭来源路径已投影，义和团条件仍没有任何国家条目。

- [ ] **Step 6: 提交数据模型实现**

```powershell
git add scripts/primary_culture_expansions.mjs scripts/build_wiki.mjs scripts/check_primary_culture_expansion_data.mjs
git commit -m "feat: project conditional primary culture paths"
```

### Task 3: 为国家详情写出失败的渲染与本地化契约

**Files:**
- Create: `scripts/check_primary_culture_detail_contract.mjs`
- Test sources: `site/app/presentation.js`, `site/styles/records.css`, `site/locales/ui.zh-Hans.js`, `site/locales/ui.en.js`, `site/index.html`

- [ ] **Step 1: 建立静态渲染契约**

新建脚本，读取站点源码并使用 `assert.ok` 验证下列稳定接口：

```js
assert.ok(/function countryPrimaryCultureExpansionsHtml\(country\)/.test(presentation), "country detail needs an expansion renderer");
assert.ok(/primaryCultureConditionalPaths/.test(presentation), "renderer must use projected condition paths");
assert.ok(/primaryCultureOptionGroups/.test(presentation), "renderer must expose exclusive route groups");
assert.ok(/primaryCultureReplacementPaths/.test(presentation), "renderer must expose replacement paths");
assert.ok(/data-country-primary-culture-expansions/.test(presentation), "renderer needs a stable browser-test root");
assert.ok(/country-primary-culture-expansion/.test(recordsCss), "detail entries need dedicated wrapping styles");
assert.ok(/board\.country\.expandablePrimaryCultures/.test(zhUi) && /board\.country\.expandablePrimaryCultures/.test(enUi), "both locales need the section label");
assert.ok(/app\/presentation\.js\?v=20260825-primary-culture-paths1/.test(indexHtml), "presentation cache token must change");
```

同一脚本还要检查 `direct`、`conditional`、`exclusive`、`replacement`、`condition`、`source`、`file`、`line`、`homelandCulture`、`formedFrom`、`culturePresent`、`integrationDecision`、`acceptanceLevel`、`vernacularDevelopment`、`unifyAfghanistanJournal` 的中英文词条均存在。

- [ ] **Step 2: 运行契约确认失败**

运行：

```powershell
node scripts/check_primary_culture_detail_contract.mjs
```

预期：因为详情辅助函数、样式、词条和新缓存参数尚不存在而失败。

- [ ] **Step 3: 提交失败测试基线**

```powershell
git add scripts/check_primary_culture_detail_contract.mjs
git commit -m "test: define primary culture detail contract"
```

### Task 4: 渲染扩展文化、条件、互斥路线与来源

**Files:**
- Modify: `site/app/presentation.js:964-1038`
- Modify: `site/styles/records.css:1578-1645`
- Modify: `site/locales/ui.zh-Hans.js:508-612`
- Modify: `site/locales/ui.en.js:508-612`
- Modify: `site/index.html:420-450`
- Test: `scripts/check_primary_culture_detail_contract.mjs`

- [ ] **Step 1: 按文化合并路径**

在 `renderCountryDetail` 之前新增 `countryPrimaryCultureExpansionsHtml(country)` 和所需的小型辅助函数。该函数应执行以下确定性过程：

```js
const routes = [
  ...(country.primaryCultureExpansionPaths || []).map((path) => ({
    ...path,
    route_kind: path.eligible_when ? "conditional" : "direct",
  })),
  ...(country.primaryCultureConditionalPaths || []).map((path) => ({ ...path, route_kind: "conditional" })),
  ...(country.primaryCultureReplacementPaths || []).map((path) => ({
    ...path,
    culture: path.added_culture,
    route_kind: "replacement",
  })),
];
```

使用来源坐标和条件序列化值去重；按活动语言的文化名称、再按 `content_type`、`content_id`、`source_file`、`source_line` 排序。每个文化只生成一个 `<details>`，即使该文化有多条来源路径。

- [ ] **Step 2: 为每条路径生成可读详情**

每个条目使用下列结构，来源不省略相对文件路径和行号：

```html
<details class="collapsible-detail-section country-primary-culture-expansion" data-primary-culture-key="catalan">
  <summary><span>加泰罗尼亚文化</span><small>条件获得</small></summary>
  <div class="collapsible-detail-body country-primary-culture-routes">
    <article class="country-primary-culture-route">
      <div class="country-primary-culture-route-meta">条件获得 · 脚本按钮</div>
      <p>条件：拥有加泰罗尼亚文化本土；国家为法国或由法国形成。</p>
      <p>来源：scripted_button:je_vernacular_policy_accept_catalan_button</p>
      <p>文件：common/scripted_buttons/06_vernacular_buttons.txt:80</p>
    </article>
  </div>
</details>
```

`homeland_culture` 与 `culture_present` 使用文化链接和 `board.country.primaryCulturePath.homelandCulture`、`culturePresent`。`country_or_was_formed_from_any` 与 `was_formed_from_any` 使用国家链接和 `formedFrom`。`primary_cultures_any` 使用文化链接和 `currentPrimaryCultures`。`requires_variable: "chose_integration_var"` 显示为“已选择语言整合”；`minimum_culture_acceptance: "acceptance_status_5"` 显示为“平均文化接纳度至少为第 5 级”；`one_of` 中的两个方言政策键显示为“满足方言政策的城市建设与法令条件”；`has_journal_entry: "je_unify_afghanistan"` 显示为“进行阿富汗统一日志”。只有可解析条件才输出“条件”行。替换路径输出“加入 X，移除 Y”，并使用 `replacement` 标签；没有已结构化条件的路径显示 `direct` 标签，但不声称该脚本在游戏内无其他可用条件。

- [ ] **Step 3: 显示选择组的互斥路线**

为每个文化查找包含该文化的 `primaryCultureOptionGroups`。将同组的其他选项显示为“互斥路线（其它结果）”，每个选项使用其 `added_primary_cultures` 的文化链接。该说明描述互斥的是路线，不能把阿富汗迈马纳路线中的乌兹别克文化误标为与同一路线互斥。南非布尔和格里夸条目必须各自显示另一条路线；阿富汗条目必须显示同一来源选择组的其它结果。

- [ ] **Step 4: 将区域接入国家详情并添加样式**

在基础 `field-grid` 内紧接开局主流文化字段调用：

```js
${field(
  t("board.country.expandablePrimaryCultures", "可扩展的主流文化"),
  countryPrimaryCultureExpansionsHtml(country),
)}
```

当没有任何直接、条件或替换路径时，`countryPrimaryCultureExpansionsHtml` 返回空字符串，避免空字段。`records.css` 中为 `.country-primary-culture-expansions`、`.country-primary-culture-route`、`.country-primary-culture-route-meta`、`.country-primary-culture-route p` 添加网格间距、分隔线、最小宽度和 `overflow-wrap:anywhere`；复用 `.collapsible-detail-section` 的折叠箭头和窄屏换行规则。

- [ ] **Step 5: 添加中英文词条并更新缓存参数**

在两份界面语言包加入如下键：

```js
"board.country.expandablePrimaryCultures"
"board.country.primaryCulturePath.direct"
"board.country.primaryCulturePath.conditional"
"board.country.primaryCulturePath.exclusive"
"board.country.primaryCulturePath.replacement"
"board.country.primaryCulturePath.condition"
"board.country.primaryCulturePath.mutuallyExclusiveRoutes"
"board.country.primaryCulturePath.source"
"board.country.primaryCulturePath.file"
"board.country.primaryCulturePath.line"
"board.country.primaryCulturePath.homelandCulture"
"board.country.primaryCulturePath.formedFrom"
"board.country.primaryCulturePath.currentPrimaryCultures"
"board.country.primaryCulturePath.culturePresent"
"board.country.primaryCulturePath.integrationDecision"
"board.country.primaryCulturePath.acceptanceLevel"
"board.country.primaryCulturePath.vernacularDevelopment"
"board.country.primaryCulturePath.unifyAfghanistanJournal"
"board.country.primaryCulturePath.replaces"
"board.country.primaryCulturePath.sourceType.event"
"board.country.primaryCulturePath.sourceType.journal"
"board.country.primaryCulturePath.sourceType.onAction"
"board.country.primaryCulturePath.sourceType.scripted"
"board.country.primaryCulturePath.sourceType.scriptedButton"
"board.country.primaryCulturePath.sourceType.scriptedEffect"
"board.country.primaryCulturePath.sourceType.amendment"
```

中文分别使用“可扩展的主流文化”“直接获得”“条件获得”“互斥选择”“替换”“条件”“互斥路线（其它结果）”“来源”“文件”“行号”；英语给出同义的自然表达。仅将 `presentation.js`、两份 UI 语言包、`records.css` 和 `styles.css` 的缓存参数改为 `20260825-primary-culture-paths1`。

- [ ] **Step 6: 运行详情契约确认通过**

运行：

```powershell
node scripts/check_primary_culture_detail_contract.mjs
node scripts/check_primary_culture_expansion_data.mjs
```

预期：两个命令均以退出码 0 结束；前者确认详情根节点、条件、互斥、替换、样式、本地化和缓存，后者确认生成数据结构没有回归。

- [ ] **Step 7: 提交详情实现**

```powershell
git add site/app/presentation.js site/styles/records.css site/styles.css site/locales/ui.zh-Hans.js site/locales/ui.en.js site/index.html scripts/check_primary_culture_detail_contract.mjs
git commit -m "feat: show primary culture expansion paths"
```

### Task 5: 重建双版本数据并验证浏览器行为

**Files:**
- Create: `scripts/check_primary_culture_detail_browser.mjs`
- Modify generated vanilla output: `site/versions/1.13.11/data-countries-*.js`, `site/versions/1.13.11/data-index.js`, `site/versions/1.13.11/search-index.js` only when emitted by `build_wiki.mjs`
- Temporary validation targets: a copied vanilla database, a copied Victorian Century database, and a copied Victorian Century standalone site under a newly created temporary directory
- Test: `scripts/check_primary_culture_detail_browser.mjs`

- [ ] **Step 1: 创建浏览器检查并先确认失败**

新建检查脚本，接收两个可选参数：原版 `index.html` 地址和 Victorian Century `index.html` 地址。默认时分别启动 `site` 和 `Victorian Century Database` 的只读本地预览服务器。对每个站点运行以下检查：

```js
await page.goto(`${baseUrl}?lang=zh-Hans#/country/FRA`);
await page.waitFor(() => Boolean(document.querySelector("[data-country-primary-culture-expansions]")), "法国扩展文化区域");
await page.click("[data-primary-culture-key='catalan'] summary");
assert.match(await page.text("[data-primary-culture-key='catalan']"), /加泰罗尼亚文化/);
assert.match(await page.text("[data-primary-culture-key='catalan']"), /条件获得/);
assert.match(await page.text("[data-primary-culture-key='catalan']"), /拥有加泰罗尼亚文化本土/);
assert.match(await page.text("[data-primary-culture-key='catalan']"), /06_vernacular_buttons\.txt:80/);
```

继续检查 `SAF` 的布尔和格里夸条目均显示互斥路线，`AFG` 的科、土库曼、乌兹别克条目同时显示阿富汗统一日志与来源形成条件，`GCO` 显示普拉特文化的 `PLT` 来源条件，`PLT` 显示瓜拉尼文化的 `PRG` 来源条件，`CHI` 没有扩展文化根节点。再以英语打开法国页，断言文化名、条件获得、本土文化、语言整合选择与接纳度条件都按英语本地化。先运行脚本；预期在生成输出尚未重建时失败。

- [ ] **Step 2: 从临时数据库重建原版输出**

使用新建临时目录，复制当前主工作目录的两个忽略数据库，不直接改写主工作目录的数据库文件。随后用工作树的脚本生成条件数据，并将原版页面输出写回工作树：

```powershell
$validationRoot = Join-Path ([System.IO.Path]::GetTempPath()) "vicdata-primary-culture-$(Get-Date -Format yyyyMMddHHmmss)"
New-Item -ItemType Directory -Path $validationRoot | Out-Null
Copy-Item -Recurse -Force 'D:\Bot\Vic3\Victoria3_DB\database\vic3_1.13.11' (Join-Path $validationRoot 'vic3_1.13.11')
Copy-Item -Recurse -Force 'D:\Bot\Vic3\Victoria3_DB\database\victorian_century' (Join-Path $validationRoot 'victorian_century')
node scripts/primary_culture_expansions.mjs --database (Join-Path $validationRoot 'vic3_1.13.11')
node scripts/build_wiki.mjs --database (Join-Path $validationRoot 'vic3_1.13.11') --out 'D:\Bot\Vic3\Victoria3_DB\.worktrees\country-incorporation-only\site\versions\1.13.11'
```

确认 `site/versions/1.13.11/data-countries-*.js` 中存在 `primaryCultureConditionalPaths`。只保留由构建器实际更新且与本功能相关的生成文件。

- [ ] **Step 3: 在临时副本中构建 Victorian Century**

复制主工作目录的独立 Victorian Century 站点到临时目录，以临时 VC 数据库生成数据块并同步工作树前端：

```powershell
$temporaryVcSite = Join-Path $validationRoot 'Victorian Century Database'
Copy-Item -Recurse -Force 'D:\Bot\Vic3\Victoria3_DB\Victorian Century Database' $temporaryVcSite
node scripts/primary_culture_expansions.mjs --database (Join-Path $validationRoot 'victorian_century')
node scripts/build_wiki.mjs --database (Join-Path $validationRoot 'victorian_century') --baseline-database (Join-Path $validationRoot 'vic3_1.13.11') --out $temporaryVcSite
node scripts/build_victorian_century_site.mjs --source 'D:\Bot\Vic3\Victoria3_DB\.worktrees\country-incorporation-only\site' --target $temporaryVcSite --vc-database (Join-Path $validationRoot 'victorian_century') --skip-vc-assets
```

这样浏览器检查使用实际 VC 数据和工作树前端，但不会覆盖主工作目录中已有的独立站文件。

- [ ] **Step 4: 运行桌面、窄屏与双语浏览器检查**

在浏览器脚本内为 `442×844` 再打开法国详情并展开加泰罗尼亚条目，断言：

```js
assert.ok(document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1);
```

用两个临时预览服务器分别传入工作树 `site/index.html?version=1.13.11` 与临时 VC `index.html`，运行：

```powershell
node scripts/check_primary_culture_detail_browser.mjs <vanilla-url> <vc-url>
```

预期输出包含原版、Victorian Century、英语和窄屏四类检查均为 `ok`。

- [ ] **Step 5: 运行相关回归并检查差异**

依次运行：

```powershell
node scripts/check_primary_culture_expansion_data.mjs
node scripts/check_primary_culture_detail_contract.mjs
node scripts/check_multilingual_board_contracts.mjs
node scripts/check_two_level_navigation.mjs
node scripts/check_primary_culture_detail_browser.mjs <vanilla-url> <vc-url>
git diff --check
git status --short --branch
```

所有命令必须退出 0。确认工作树只包含本计划列出的源码、测试、语言包、样式和生成的 1.13.11 数据文件；临时目录仅在检查完成后删除。


- [ ] **Step 6: 记录结果并提交验证产物**

新增 `docs/worklog/2026-08-25-primary-culture-conditional-paths.md`，仅使用“目标、已完成修改、未解决问题、涉及文件、测试结果、下一步”六个小节。隔离工作树不含主工作目录的根工作记录与任务清单，因此不在此处创建其副本或修改主工作目录；合并至 `main` 后再更新根工作记录和任务状态。提交：

```powershell
git add scripts/check_primary_culture_detail_browser.mjs site/versions/1.13.11 docs/worklog/2026-08-25-primary-culture-conditional-paths.md
git commit -m "test: verify primary culture detail paths"
```

- [ ] **Step 7: 提供隔离工作树交接结果**

报告工作树路径 `D:\Bot\Vic3\Victoria3_DB\.worktrees\country-incorporation-only`、分支 `codex/country-incorporation-only`、本轮提交、生成数据范围和每项检查的实际结果。此阶段不合并、不推送、不发布，也不修改主工作目录中无关的未提交文件。
