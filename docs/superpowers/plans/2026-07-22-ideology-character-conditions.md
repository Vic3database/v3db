# 角色意识形态条件校对实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 1.13.9 意识形态页改为可核对角色意识形态候选池、国家条件、领袖条件、权重与国家风味来源的资料页。

**Architecture:** 提取器从角色意识形态定义和 `common/scripted_triggers` 生成结构化条件，直接写入现有 `ideologies.json`；利益集团基础候选也以显式关系随意识形态导出。站点的意识形态数据块不改变边界，详情组件用该结构渲染“角色出现条件”，筛选和搜索使用同一组辅助函数，避免以文件名或显示名称推断条件。

**Tech Stack:** Node.js ES 模块、Clausewitz 脚本解析器、静态 JavaScript、CSS、现有 Node 断言脚本。

---

## 文件结构

- 修改：`scripts/extract_vic3_countries.mjs`：加载脚本条件定义，导出直接条件、展开条件、国家与文化引用、国家类型提示和角色意识形态基础候选利益集团。
- 修改：`scripts/check_ui_ideology_contracts.mjs`：校验提取数据与前端条件、筛选、搜索契约。
- 修改：`site/app/runtime.js`：将“出现方式”选项改为基础候选、科技条件、国家风味、事件或日志。
- 修改：`site/app/components.js`：渲染角色出现条件、展开脚本条件，复用条件引用标签，并扩展意识形态搜索与出现方式分类。
- 修改：`site/app/presentation.js`：在意识形态详情中调用新的角色出现条件区。
- 修改：`site/styles/records.css`：为条件来源、直接条件和脚本条件嵌套展示补充紧凑样式。
- 生成：`database/vic3_1.13.9/index.json`、`database/vic3_1.13.9/ideologies.json`、`database/vic3_1.13.9/interest_groups.json`：更新后的 1.13.9 数据。
- 生成：`site/versions/1.13.9/data-ideologies.js`、`site/versions/1.13.9/data-index.js`：发布数据块与更新时间。

### Task 1: 提取角色条件和基础候选关系

**Files:**

- Modify: `scripts/extract_vic3_countries.mjs:161-195,1371-1409,1659-1690,1752-1790,4292-4466`
- Test: `scripts/check_ui_ideology_contracts.mjs:285-390`

- [ ] **Step 1: 先加入会失败的数据断言。**

在 `checkIdeologyContracts()` 的 `ideologyByKey` 创建后加入下列断言；此时 `character_candidate_interest_groups`、`scripted_triggers` 和国家引用尚未导出，检查必须失败。

```js
const moderate = ideologyByKey.get("ideology_moderate");
assert.deepEqual(
  moderate?.character_candidate_interest_groups?.map((item) => item.key),
  [
    "ig_armed_forces",
    "ig_devout",
    "ig_industrialists",
    "ig_intelligentsia",
    "ig_landowners",
    "ig_petty_bourgeoisie",
    "ig_rural_folk",
    "ig_trade_unions",
  ],
  "ideology_moderate should expose all eight base character candidate groups",
);

const marketLiberal = ideologyByKey.get("ideology_market_liberal");
assert(marketLiberal?.character_requirements?.country?.technologies?.some((item) => item.key === "stock_exchange"), "market liberal should expose the Stock Exchange country requirement");
const despoticUtopian = ideologyByKey.get("ideology_despotic_utopian");
assert(despoticUtopian?.character_requirements?.country?.countries?.some((item) => item.key === "PRG"), "despotic utopian should expose Paraguay in its country condition");
assert.deepEqual(
  despoticUtopian?.character_candidate_interest_groups?.map((item) => item.key),
  ["ig_intelligentsia", "ig_petty_bourgeoisie", "ig_trade_unions"],
  "despotic utopian should expose its three base candidate groups",
);
assert(
  despoticUtopian?.character_requirements?.interest_group_leader?.scripted_triggers?.some((item) => item.key === "ideology_despotic_utopian_valid_trigger"),
  "despotic utopian should expose its expanded leader scripted trigger",
);
```

- [ ] **Step 2: 运行断言，确认缺少的新字段会被检出。**

Run: `node scripts/check_ui_ideology_contracts.mjs`

Expected: FAIL，至少包含 `ideology_moderate should expose all eight base character candidate groups`。

- [ ] **Step 3: 读取并保存脚本条件定义。**

在 `main()` 中，加载意识形态前添加 `const scriptedTriggers = loadScriptedTriggers(contentPath("common", "scripted_triggers"));`，并把该映射传给 `loadIdeologies`。在 `loadIdeologies` 前新增如下完整辅助函数；值保留原始 Clausewitz AST，供后续条件展开使用。

```js
function loadScriptedTriggers(dir) {
  const rows = new Map();
  for (const file of listFiles(dir)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      if (!key) continue;
      rows.set(key, {
        key,
        value: assignment.value,
        source_file: normalizePath(file),
      });
    }
  }
  return rows;
}
```

将 `loadIdeologies` 的签名改为 `function loadIdeologies(dir, loc, scriptedTriggers)`，并将三处 `characterIdeologyRequirements(node, loc)` 改为 `characterIdeologyRequirements(node, loc, scriptedTriggers)`。

- [ ] **Step 4: 导出直接条件、可点击引用和脚本条件展开。**

用下列版本替换 `characterIdeologyRequirements` 与 `conditionSummaryObject`。`scripted_triggers` 只记录当前条件直接调用的已定义脚本条件；递归调用通过 `visited` 防止循环。各触发器自身仍导出完整摘要、引用、嵌套触发器和原始脚本。

```js
function characterIdeologyRequirements(node, loc, scriptedTriggers) {
  const result = {
    country: conditionSummaryObject(firstValue(node, "country_trigger"), loc, scriptedTriggers),
    interest_group_leader: conditionSummaryObject(firstValue(node, "interest_group_leader_trigger"), loc, scriptedTriggers),
    non_interest_group_leader: conditionSummaryObject(firstValue(node, "non_interest_group_leader_trigger"), loc, scriptedTriggers),
  };
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value));
}

function conditionSummaryObject(value, loc, scriptedTriggers = new Map(), visited = new Set()) {
  if (!value) return null;
  const raw = stringifyScriptValue(value);
  const triggerKeys = [...collectScriptedTriggerRefs(value, scriptedTriggers)].sort();
  return {
    summary_zh: summarizeScriptCondition(value, loc),
    raw,
    interest_groups: refObjects([...collectInterestGroupRefs(value)], loc, "interest_group"),
    countries: countryRefs([...collectCountryRefs(value)], loc),
    cultures: refObjects([...collectCultureRefs(value)], loc, "culture"),
    country_types: collectCountryTypeHints(raw),
    laws: refObjects([...collectLawRefs(value)], loc, "law"),
    technologies: refsToObjects([...collectTechnologyRefs(value)], loc),
    journal_entries: refsToObjects([...collectJournalEntryRefs(value)], loc),
    traits: traitRefs([...collectCharacterTraitRefs(value)], loc),
    variables: [...collectVariableRefs(value)].sort(),
    scripted_triggers: triggerKeys.map((key) => scriptedTriggerSummary(key, loc, scriptedTriggers, visited)),
  };
}

function scriptedTriggerSummary(key, loc, scriptedTriggers, visited) {
  const trigger = scriptedTriggers.get(key);
  if (!trigger) return { key, summary_zh: "脚本条件", raw: "", source_file: "", scripted_triggers: [] };
  if (visited.has(key)) return { key, summary_zh: "循环引用", raw: "", source_file: trigger.source_file, scripted_triggers: [] };
  const details = conditionSummaryObject(trigger.value, loc, scriptedTriggers, new Set([...visited, key]));
  return { key, source_file: trigger.source_file, ...details };
}
```

新增 `collectScriptedTriggerRefs`、`collectCountryRefs`、`collectCultureRefs`、`countryRefs` 和 `collectCountryTypeHints`。前四个函数递归遍历 `node.items`、`node.assignments` 和字符串，分别识别现有 `scriptedTriggers` 中键为真值赋值的调用、`c:TAG`、`cu:culture`、`country_has_primary_culture = cu:culture`。`collectCountryTypeHints` 返回只读对象数组，并固定映射 `country_is_colonial_or_company = yes` 为 `{ key: "colonial_or_company", name_zh: "殖民地或公司" }`，`is_country_type = unrecognized` 为 `{ key: "unrecognized", name_zh: "未受认可国家" }`。在 `summarizeScriptCondition` 中追加国家、主流文化和国家类型提示，使用 `locName` 输出本地化名称。

- [ ] **Step 5: 导出每项角色意识形态的基础候选利益集团。**

在 `loadInterestGroups(...)` 完成后、`applyIdeologyUnlockSources(...)` 前调用 `applyCharacterIdeologyCandidateGroups(ideologies, interestGroups)`。新增如下函数，按利益集团固定 `index` 和键排序，避免输出随文件读取顺序变化。

```js
function applyCharacterIdeologyCandidateGroups(ideologies, interestGroups) {
  const groupsByIdeology = new Map();
  for (const group of interestGroups || []) {
    for (const key of group._character_ideology_keys || []) {
      if (!groupsByIdeology.has(key)) groupsByIdeology.set(key, []);
      groupsByIdeology.get(key).push({
        id: group.id,
        key: group.key,
        name_zh: group.name_zh,
        index: group.index ?? Number.MAX_SAFE_INTEGER,
      });
    }
  }
  for (const ideology of ideologies.values()) {
    ideology.character_candidate_interest_groups = (groupsByIdeology.get(ideology.key) || [])
      .sort((left, right) => left.index - right.index || left.key.localeCompare(right.key))
      .map(({ index, ...group }) => group);
  }
}
```

- [ ] **Step 6: 执行提取器，重新生成 1.13.9 数据并确认断言通过。**

Run: `node scripts/extract_vic3_countries.mjs --game-path "D:\SteamLibrary\steamapps\common\Victoria 3" --version 1.13.9 --out output --database database/vic3_1.13.9; node scripts/check_ui_ideology_contracts.mjs`

Expected: 提取输出包含 172 项意识形态；合同检查不再报告基础候选、证券交易所、巴拉圭或展开脚本条件缺失。

- [ ] **Step 7: 提交数据提取和数据契约。**

```powershell
git add -- scripts/extract_vic3_countries.mjs scripts/check_ui_ideology_contracts.mjs database/vic3_1.13.9/index.json database/vic3_1.13.9/ideologies.json database/vic3_1.13.9/interest_groups.json
git commit -m "feat: extract character ideology conditions"
```

### Task 2: 渲染角色出现条件

**Files:**

- Modify: `site/app/components.js:770-778,991-1098,2247-2316`
- Modify: `site/app/presentation.js:652-693`
- Modify: `site/styles/records.css:964-1025`
- Test: `scripts/check_ui_ideology_contracts.mjs:285-390`

- [ ] **Step 1: 为详情渲染加入会失败的静态契约。**

在 `checkIdeologyContracts()` 加入：

```js
assert(/function ideologyCharacterConditionsHtml\(/.test(appSource), "character-condition renderer is missing");
assert(/基础候选利益集团/.test(appSource), "character-condition renderer should label base candidate groups");
assert(/利益集团领袖条件/.test(appSource), "character-condition renderer should label interest-group leader conditions");
assert(/脚本条件：/.test(appSource), "character-condition renderer should label expanded scripted triggers");
assert(/角色出现条件/.test(appSource), "ideology detail should use the character-condition section title");
assert(/ideologyCharacterConditionsHtml\(ideology\)/.test(appSource), "ideology detail should render character conditions");
```

- [ ] **Step 2: 运行合同检查，确认渲染入口尚不存在。**

Run: `node scripts/check_ui_ideology_contracts.mjs`

Expected: FAIL，包含 `character-condition renderer is missing`。

- [ ] **Step 3: 用“角色出现条件”替换旧的“角色权重”包装层。**

在 `site/app/components.js` 用下列函数替换 `ideologyWeightSectionHtml`；保留现有 `weightRequirementHtml`、`weightListHtml`、`weightEntryHtml` 和 `conditionRefPills`，但由新函数调用。对历史版本没有新字段的项目，基础候选区根据 `relatedIdeologyUsage(ideology).characterInterestGroups` 回退计算。

```js
function ideologyCharacterConditionsHtml(ideology) {
  if (!ideology?.character_ideology) return "";
  const requirements = ideology.character_requirements || {};
  const candidates = ideology.character_candidate_interest_groups?.length
    ? ideology.character_candidate_interest_groups
    : relatedIdeologyUsage(ideology).characterInterestGroups;
  const sections = [
    candidates.length ? conditionRefSectionHtml("基础候选利益集团", interestGroupRefPills(candidates, "tag-ig-changed")) : "",
    weightRequirementHtml("国家条件", requirements.country),
    weightRequirementHtml("利益集团领袖条件", requirements.interest_group_leader),
    weightRequirementHtml("非利益集团领袖条件", requirements.non_interest_group_leader),
    weightListHtml("利益集团领袖权重", ideology.interest_group_leader_weight),
    weightListHtml("非利益集团领袖权重", ideology.non_interest_group_leader_weight),
  ].filter(Boolean).join("");
  if (!sections) return "";
  return `
    <details class="collapsible-detail-section ideology-weight-section">
      <summary><span>角色出现条件</span><small>候选、条件与权重修正</small></summary>
      <div class="collapsible-detail-body ideology-weight-body">${sections}</div>
    </details>
  `;
}

function conditionRefSectionHtml(label, html) {
  return `<section class="ideology-weight-group"><h3>${escapeHtml(label)}</h3><div class="ideology-weight-refs">${html}</div></section>`;
}
```

在 `renderIdeologyDetail` 中把 `${ideologyWeightSectionHtml(ideology)}` 替换为 `${ideologyCharacterConditionsHtml(ideology)}`。

- [ ] **Step 4: 渲染直接条件的国家、文化、类型和展开脚本条件。**

将 `conditionRefPills` 的 `parts` 扩充为下列顺序，以保持利益集团、国家、文化、国家类型、法律、科技、日志、特质的阅读顺序；国家必须使用 `kind: "country"`，使标签链接到国家详情。

```js
const parts = [
  refItemsPills(condition.interest_groups, "interestGroup", "tag-ig-changed"),
  refItemsPills(condition.countries, "country", "tag-country"),
  refItemsPills(condition.cultures, "culture", "tag-culture"),
  refItemsPills(condition.country_types, "", "tag-type"),
  refItemsPills(condition.laws, "law", "tag-law"),
  refItemsPills(condition.technologies, "", "tag-technology"),
  refItemsPills(condition.journal_entries, "", "tag-journal"),
  refItemsPills(condition.traits, "trait", "tag-tradition"),
].filter(Boolean);
```

在 `weightRequirementHtml` 的条件脚本前增加 `${scriptedTriggerRequirementsHtml(requirement.scripted_triggers)}`。新增的 `scriptedTriggerRequirementsHtml` 对每个项目渲染 `<details class="ideology-scripted-trigger">`，摘要为 `脚本条件：${trigger.key}`，正文依次显示 `trigger.summary_zh`、`conditionRefPills(trigger)`、嵌套触发器和 `rawDetails("条件脚本", trigger.raw)`；空数组返回空字符串。嵌套项目通过同一函数递归渲染，循环引用只显示“循环引用”，不再展开。

- [ ] **Step 5: 将展开条件加入全站搜索。**

在 `ideologyWeightSearchParts` 的返回数组末尾增加：

```js
...scriptedTriggerSearchParts(ideology.character_requirements?.country?.scripted_triggers),
...scriptedTriggerSearchParts(ideology.character_requirements?.interest_group_leader?.scripted_triggers),
...scriptedTriggerSearchParts(ideology.character_requirements?.non_interest_group_leader?.scripted_triggers),
...refSearchParts(ideology.character_candidate_interest_groups),
```

新增 `scriptedTriggerSearchParts(triggers)`，逐项加入 `key`、`summary_zh`、`source_file`、`conditionSearchParts(trigger)` 和递归的 `trigger.scripted_triggers`。这样“东印度”“政治鼓动”“帕蒂尼奥”均能命中关联角色意识形态。

- [ ] **Step 6: 添加必要的紧凑样式。**

在 `site/styles/records.css` 的 `.ideology-weight-group p` 后添加：

```css
.ideology-scripted-trigger {
  border-top: 1px solid color-mix(in srgb, var(--line) 76%, transparent);
  padding-top: 8px;
}

.ideology-scripted-trigger > summary {
  color: var(--muted);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: 700;
}

.ideology-scripted-trigger-body {
  display: grid;
  gap: 8px;
  margin-top: 8px;
}
```

- [ ] **Step 7: 运行合同和语法检查。**

Run: `node --check site/app/components.js; node --check site/app/presentation.js; node scripts/check_ui_ideology_contracts.mjs`

Expected: PASS，详情代码含“角色出现条件”、基础候选标签和展开脚本条件。

- [ ] **Step 8: 提交详情展示。**

```powershell
git add -- site/app/components.js site/app/presentation.js site/styles/records.css scripts/check_ui_ideology_contracts.mjs
git commit -m "feat: show character ideology conditions"
```

### Task 3: 校正出现方式筛选

**Files:**

- Modify: `site/app/runtime.js:509-514`
- Modify: `site/app/components.js:770-778,2247-2316`
- Modify: `site/app/filters.js:93-100,551-570`
- Modify: `scripts/check_ui_ideology_contracts.mjs:285-390`
- Test: `scripts/check_ui_ideology_contracts.mjs`

- [ ] **Step 1: 增加会失败的筛选契约。**

在 `checkIdeologyContracts()` 增加：

```js
for (const label of ["基础候选", "科技条件", "国家风味", "事件或日志"]) {
  assert(appSource.includes(label), `ideology occurrence filter should expose ${label}`);
}
assert(/function ideologyHasCountryFlavorCondition\(/.test(appSource), "country-flavor classifier is missing");
assert(/function scriptedTriggerSearchParts\(/.test(appSource), "expanded trigger search helper is missing");
```

- [ ] **Step 2: 运行检查，确认新筛选语义尚未接入。**

Run: `node scripts/check_ui_ideology_contracts.mjs`

Expected: FAIL，包含 `ideology occurrence filter should expose 基础候选`。

- [ ] **Step 3: 替换选项和分类函数。**

在 `site/app/runtime.js` 用下列数组替换 `ideologyOccurrenceOptions`：

```js
const ideologyOccurrenceOptions = [
  { key: "base_character", label: "基础候选" },
  { key: "technology_condition", label: "科技条件" },
  { key: "country_flavor", label: "国家风味" },
  { key: "event_journal", label: "事件或日志" },
];
```

用下列逻辑替换 `ideologyOccurrenceRefs`，保持返回对象形状和 `matchesRefSet` 的多选交集语义：

```js
function ideologyOccurrenceRefs(ideology) {
  const keys = new Set();
  const requirements = ideology.character_requirements || {};
  const related = relatedIdeologyUsage(ideology);
  const sources = ideology.unlock_sources || [];
  if ((ideology.character_candidate_interest_groups || related.characterInterestGroups || []).length) keys.add("base_character");
  if (ideologyHasTechnologyCondition(requirements) || (ideology.unlock_technologies || []).length) keys.add("technology_condition");
  if (ideologyHasCountryFlavorCondition(ideology, requirements, related)) keys.add("country_flavor");
  if (sources.some((source) => source.kind === "event_or_journal" || source.kind === "political_movement") || (ideology.unlock_journal_entries || []).length) keys.add("event_journal");
  return [...keys].map((key) => ({ key, name_zh: ideologyOccurrenceOptions.find((item) => item.key === key)?.label || key }));
}
```

新增 `ideologyHasTechnologyCondition(requirements)`，检查三个直接条件与其递归脚本条件中的 `technologies`。新增 `ideologyHasCountryFlavorCondition(ideology, requirements, related)`，当存在 `related.flavorUsage`、`ideology.flavor_definition_status`、角色条件中的国家引用、文化引用或国家类型提示时返回真。该函数不得以意识形态中文名或文件名作为唯一依据。

- [ ] **Step 4: 将更新后的分类加入搜索，并验证筛选交集。**

保留 `matchesIdeologyFilters` 中的 `matchesRefSet(state.ideologyOccurrences, ideologyOccurrenceRefs(ideology))`，不将多选改为并集。合同检查中用 `ideologyOccurrenceRefs` 的源码断言确认四个新键出现，并在数据断言中验证：温和主义者含 `base_character`；市场自由主义者含 `technology_condition`；专制乌托邦主义者含 `country_flavor`；奥尔良派含 `country_flavor` 与 `event_journal` 之外至少保留法兰西国家引用。

- [ ] **Step 5: 运行前端检查。**

Run: `node --check site/app/runtime.js; node --check site/app/components.js; node --check site/app/filters.js; node scripts/check_ui_ideology_contracts.mjs`

Expected: PASS，旧的“默认”“风味”“科技”“日志”选项不再用于 `ideologyOccurrenceOptions`。

- [ ] **Step 6: 提交筛选变更。**

```powershell
git add -- site/app/runtime.js site/app/components.js site/app/filters.js scripts/check_ui_ideology_contracts.mjs
git commit -m "feat: refine ideology occurrence filters"
```

### Task 4: 发布数据并完成回归验证

**Files:**

- Modify: `database/vic3_1.13.9/index.json`
- Modify: `database/vic3_1.13.9/ideologies.json`
- Modify: `database/vic3_1.13.9/interest_groups.json`
- Modify: `site/versions/1.13.9/data-ideologies.js`
- Modify: `site/versions/1.13.9/data-index.js`
- Test: `scripts/check_ui_ideology_contracts.mjs`, `scripts/check_data_chunking.mjs`, `scripts/check_publish_bundle.mjs`

- [ ] **Step 1: 重新生成数据库与网站意识形态数据块。**

Run:

```powershell
node scripts/extract_vic3_countries.mjs --game-path "D:\SteamLibrary\steamapps\common\Victoria 3" --version 1.13.9 --out output --database database/vic3_1.13.9
node scripts/build_wiki.mjs --database database/vic3_1.13.9 --out site/versions/1.13.9
```

Expected: 第一条命令输出 172 项意识形态；第二条命令生成 `data-ideologies.js` 和包含 `ideology` 块的 `data-index.js`，不生成完整 `data.js`。

- [ ] **Step 2: 运行静态回归检查。**

Run:

```powershell
node --check scripts/extract_vic3_countries.mjs
node --check site/app/runtime.js
node --check site/app/components.js
node --check site/app/presentation.js
node --check site/app/filters.js
node scripts/check_ui_ideology_contracts.mjs
node scripts/check_data_chunking.mjs
node scripts/check_publish_bundle.mjs
git diff --check
```

Expected: 全部命令退出码为 0；`check_ui_ideology_contracts.mjs` 输出 `ui_ideology_contracts: "ok"`；`check_data_chunking.mjs` 输出 `data_chunking: "ok"`。

- [ ] **Step 3: 在浏览器核验详情和筛选。**

启动本地站点并依次打开：

```powershell
node scripts/serve_site.mjs site 8876
```

在 `http://127.0.0.1:8876/#/ideology/ideology_moderate` 确认“角色出现条件”列出八个基础候选利益集团；在 `#/ideology/ideology_market_liberal` 确认国家条件显示“证券交易所”；在 `#/ideology/ideology_despotic_utopian` 确认巴拉圭、知识分子、小市民、工会和展开的脚本条件可见；在 `#/ideology/ideology_orleanist` 确认法兰西条件；在 `#/ideology/ideology_mitogaku` 确认日本、学术界与未受认可国家条件。分别选中“基础候选”“科技条件”“国家风味”“事件或日志”，再组合“基础候选”和“科技条件”，确认结果数变化、详情可打开、控制台无页面错误，并在 390 像素宽度确认没有横向溢出。

- [ ] **Step 4: 提交发布数据和最终校验。**

```powershell
git add -- database/vic3_1.13.9/index.json database/vic3_1.13.9/ideologies.json database/vic3_1.13.9/interest_groups.json site/versions/1.13.9/data-ideologies.js site/versions/1.13.9/data-index.js scripts/extract_vic3_countries.mjs scripts/check_ui_ideology_contracts.mjs site/app/runtime.js site/app/components.js site/app/presentation.js site/app/filters.js site/styles/records.css
git commit -m "feat: document character ideology conditions"
```
