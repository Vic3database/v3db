# 国家风味内容双向关联实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 VC 合并后的日志、事件和决议生成可审计的主体国家范围，并在国家详情和三个内容详情之间建立双向跳转。

**Architecture:** 构建阶段使用独立分析模块提取主体国家、带作用域的内容调用、稳定组范围和继承证据，再生成正向 `country_scope`、证据、审计报告及国家反向索引。浏览器只读取生成数据，共用一个关联组件渲染“相关国家”和“风味内容”，不在页面运行时分析脚本。

**Tech Stack:** Node.js 24、ES modules、Victoria 3 Clausewitz 脚本、原生 JavaScript、静态 HTML/CSS、Node `assert`、Chrome DevTools Protocol。

---

## 文件结构

新增 `scripts/content_country_scope.mjs`，只负责脚本条件、调用关系、组范围、继承和反向索引。新增 `scripts/content_country_scope_overrides.mjs`，保存有源码位置的稳定事件组范围和少量人工校正。新增两个数据检查脚本，分别覆盖小型构造数据和完整 VC 数据。

新增 `site/app/content-country-links.js`，只负责国家关联组件。现有 `events.js`、`journals.js`、`decisions.js` 和 `presentation.js` 调用该组件。新增 `styles/content-associations.css` 保存关联组件样式，避免继续扩大 `events.css`。构建产物增加 `content-country-association-audit.json`，站点的 `data-content.js` 增加 `contentByCountry`。

### Task 1：解析主体条件与带作用域的内容调用

**Files:**
- Create: `scripts/content_country_scope.mjs`
- Create: `scripts/check_content_country_scope_unit.mjs`

- [ ] **Step 1：先写主体条件与调用关系的失败测试**

创建 `scripts/check_content_country_scope_unit.mjs`，使用小型脚本记录覆盖正向、反向、否定条件、当前主体、明确国家和未知国家作用域：

```js
import assert from "node:assert/strict";
import {
  extractDirectCountryEvidence,
  extractScopedContentRelations,
} from "./content_country_scope.mjs";

const decision = {
  id: "decision_austria",
  source_file: "common/decisions/austria.txt",
  is_shown_raw: `is_shown = {
    c:AUS ?= ROOT
    NOT = { c:HUN ?= ROOT }
  }`,
  possible_raw: `possible = { ROOT ?= c:AUS }`,
  when_taken_raw: `when_taken = {
    trigger_event = { id = austria_events.1 }
    c:HUN ?= { trigger_event = { id = hungary_events.1 } }
    random_country = { trigger_event = { id = unknown_events.1 } }
    add_journal_entry = { type = je_austria }
  }`,
};

assert.deepEqual(
  extractDirectCountryEvidence(decision, "decision").map((item) => item.country),
  ["AUS"],
  "否定条件中的匈牙利不能成为主体国家",
);
assert.deepEqual(
  extractScopedContentRelations(decision, "decision").map(({ target_kind, target_id, scope_kind, country }) => ({ target_kind, target_id, scope_kind, country })),
  [
    { target_kind: "event", target_id: "austria_events.1", scope_kind: "current", country: "" },
    { target_kind: "event", target_id: "hungary_events.1", scope_kind: "country", country: "HUN" },
    { target_kind: "event", target_id: "unknown_events.1", scope_kind: "unknown", country: "" },
    { target_kind: "journal", target_id: "je_austria", scope_kind: "current", country: "" },
  ],
);

console.log(JSON.stringify({ content_country_scope_unit: "parser-ok" }, null, 2));
```

- [ ] **Step 2：运行测试并确认缺少模块或导出函数**

Run: `node scripts/check_content_country_scope_unit.mjs`

Expected: FAIL，错误指向 `content_country_scope.mjs` 不存在或所需导出函数不存在。

- [ ] **Step 3：实现独立的 Clausewitz 条件与调用解析器**

在 `scripts/content_country_scope.mjs` 中实现以下接口。词法分析保留键、操作符和嵌套块；遍历 `NOT`、`NOR` 时标记否定上下文；`random_country`、`any_country`、`every_country`、`scope:*` 和临时国家作用域标记为 `unknown`。`ROOT`、`root` 与普通条件／效果块保持当前主体作用域，`c:TAG` 嵌套块切换到明确国家。

```js
const COUNTRY_COMPARE_RE = /^(?:c:([A-Za-z0-9_]+)\s*\?=\s*(?:ROOT|root|this)|(?:ROOT|root|this)\s*\?=\s*c:([A-Za-z0-9_]+))$/i;
const UNKNOWN_COUNTRY_SCOPE_RE = /^(?:random_|any_|every_|ordered_).*(?:country|subject)|^scope:/i;
const EVENT_CALL_KEYS = new Set(["trigger_event", "events", "random_events"]);
const JOURNAL_CALL_KEYS = new Set(["add_journal_entry", "activate_journal_entry", "create_journal_entry"]);

export function extractDirectCountryEvidence(row, contentType) {
  const fields = directEvidenceFields(row, contentType);
  const evidence = [];
  for (const [sourceField, raw] of fields) {
    walkConditions(parseClausewitz(raw), { negated: false }, (assignment, context) => {
      if (context.negated || typeof assignment.value !== "string") return;
      const expression = `${assignment.key} ${assignment.op} ${assignment.value}`;
      const match = expression.match(COUNTRY_COMPARE_RE);
      const country = (match?.[1] || match?.[2] || "").toUpperCase();
      if (country) evidence.push({ country, kind: "direct", source_field: sourceField, expression });
    });
  }
  return uniqueEvidence(evidence);
}

export function extractScopedContentRelations(row, contentType) {
  const relations = [];
  walkRelations(parseClausewitz(row.raw || ""), { kind: "current", country: "" }, (assignment, scope) => {
    if (EVENT_CALL_KEYS.has(assignment.key)) {
      for (const targetId of eventTargets(assignment.value)) relations.push(relation(row, contentType, "event", targetId, scope));
    }
    if (JOURNAL_CALL_KEYS.has(assignment.key)) {
      const targetId = journalTarget(assignment.value);
      if (targetId) relations.push(relation(row, contentType, "journal", targetId, scope));
    }
  });
  return uniqueRelations(relations);
}
```

`directEvidenceFields()` 必须只返回日志的 `is_shown_when_inactive_raw`、`possible_raw`，事件的 `trigger_raw`，决议的 `is_shown_raw`、`possible_raw`。`has_journal_entry` 等条件检查不进入关系结果。

- [ ] **Step 4：运行解析器测试并确认通过**

Run: `node scripts/check_content_country_scope_unit.mjs`

Expected: PASS，并输出 `content_country_scope_unit: parser-ok`。

- [ ] **Step 5：提交解析器和单元测试**

```powershell
git add -- scripts/content_country_scope.mjs scripts/check_content_country_scope_unit.mjs
git commit -m "feat: parse country scoped content relations"
```

### Task 2：实现稳定组范围、人工校正与关系传播

**Files:**
- Create: `scripts/content_country_scope_overrides.mjs`
- Modify: `scripts/content_country_scope.mjs`
- Modify: `scripts/check_content_country_scope_unit.mjs`
- Modify: `scripts/event_kind.mjs`

- [ ] **Step 1：为组阈值、多级传播、多国合并和循环写失败测试**

在单元测试中加入构造数据。九个同组事件中八个直接限定英国，第九个应得到组证据；奥地利决议触发事件后再开启日志，国家范围应传播两级；匈牙利明确国家作用域应覆盖来源国；未知作用域不传播。

```js
import { classifyContentCountryScopes } from "./content_country_scope.mjs";

const groupEvents = Array.from({ length: 9 }, (_, index) => ({
  id: `britain_events.${index + 1}`,
  namespace: "britain_events",
  content_class: "game",
  trigger_raw: index < 8 ? "trigger = { c:GBR ?= ROOT }" : "trigger = { always = yes }",
  raw: index === 0 ? "britain_events.1 = { trigger_event = { id = britain_events.2 } }" : `${`britain_events.${index + 1}`} = {}`,
}));
const graph = classifyContentCountryScopes({
  journals: [{ id: "je_austria", group: "je_group_austria", content_class: "game", raw: "je_austria = {}" }],
  events: [
    ...groupEvents,
    { id: "austria_events.1", namespace: "austria_events", content_class: "game", raw: "austria_events.1 = { add_journal_entry = { type = je_austria } }", trigger_raw: "" },
    { id: "hungary_events.1", namespace: "hungary_events", content_class: "game", raw: "hungary_events.1 = {}", trigger_raw: "" },
    { id: "unknown_events.1", namespace: "unknown_events", content_class: "game", raw: "unknown_events.1 = {}", trigger_raw: "" },
  ],
  decisions: [decision],
  overrides: [],
});

assert.deepEqual(graph.by_id.get("event:britain_events.9").country_scope, ["GBR"]);
assert.equal(graph.by_id.get("event:britain_events.9").country_scope_evidence[0].kind, "group");
assert.deepEqual(graph.by_id.get("event:austria_events.1").country_scope, ["AUS"]);
assert.deepEqual(graph.by_id.get("journal:je_austria").country_scope, ["AUS"]);
assert.deepEqual(graph.by_id.get("event:hungary_events.1").country_scope, ["HUN"]);
assert.deepEqual(graph.by_id.get("event:unknown_events.1").country_scope, []);
assert.equal(graph.by_id.get("journal:je_austria").content_kind, "flavor");

const overridden = classifyContentCountryScopes({
  journals: [],
  events: [{ id: "override_events.1", namespace: "override_events", content_class: "game", raw: "override_events.1 = {}", trigger_raw: "trigger = { c:FRA ?= ROOT }" }],
  decisions: [],
  overrides: [
    { action: "add", content_type: "event", content_id: "override_events.1", country: "BEL", reason: "测试人工增加", source_file: "events/override_events.txt", source_line: 1 },
    { action: "exclude", content_type: "event", content_id: "override_events.1", country: "FRA", reason: "测试人工排除", source_file: "events/override_events.txt", source_line: 2 },
  ],
});
assert.deepEqual(overridden.by_id.get("event:override_events.1").country_scope, ["BEL"]);
assert.equal(overridden.by_id.get("event:override_events.1").country_scope_evidence[0].kind, "override");
```

- [ ] **Step 2：运行测试并确认分类函数缺失**

Run: `node scripts/check_content_country_scope_unit.mjs`

Expected: FAIL，错误指向 `classifyContentCountryScopes` 未导出。

- [ ] **Step 3：建立统一校正表并复用已确认的事件组范围**

创建 `scripts/content_country_scope_overrides.mjs`。稳定事件组记录作为组证据输入，人工条目使用严格字段；初始人工条目可以为空。

```js
export const STABLE_EVENT_GROUP_COUNTRIES = Object.freeze({
  acw_events: { countries: ["CSA", "FSA", "USA"], source_file: "events/american_civil_war/acw_events.txt", source_line: 5 },
  acw_je_events: { countries: ["CSA", "FSA", "USA"], source_file: "events/american_civil_war/acw_je_events.txt", source_line: 4 },
  algeria_events: { countries: ["ALD", "FRA"], source_file: "events/agitators_events/algeria_events.txt", source_line: 4 },
  federation_of_india: { countries: ["BHT", "BIC"], source_file: "events/india_events/federation_of_india.txt", source_line: 3 },
  fsa_events: { countries: ["FSA", "USA"], source_file: "events/american_civil_war/00_fsa_events.txt", source_line: 4 },
});

export const CONTENT_COUNTRY_SCOPE_OVERRIDES = Object.freeze([]);
```

修改 `scripts/event_kind.mjs`，从该文件导入 `STABLE_EVENT_GROUP_COUNTRIES` 并生成原有的命名空间集合及标签映射，删除重复的本地常量。运行现有事件分类测试，确保原版事件板块结果未变。

- [ ] **Step 4：实现分类、组统计、校正和固定点传播**

在 `content_country_scope.mjs` 中导出统一分类接口：

```js
export function classifyContentCountryScopes({ journals = [], events = [], decisions = [], overrides = [], stableEventGroups = {} }) {
  const records = normalizeContentRecords({ journals, events, decisions });
  const byId = new Map(records.map((record) => [record.node_id, record]));
  for (const record of records) addEvidence(record, extractDirectCountryEvidence(record.row, record.kind));
  applyStableGroups(records, stableEventGroups);
  applyStatisticalGroups(records, { minimumCoverage: 0.8, maximumCountries: 8 });
  applyAddOverrides(byId, overrides);

  const relations = records.flatMap((record) => extractScopedContentRelations(record.row, record.kind));
  propagateCountryScopes(byId, relations);
  applyExcludeOverrides(byId, overrides);

  for (const record of records) {
    record.country_scope = [...new Set(record.country_scope)].sort();
    record.content_kind = record.country_scope.length ? "flavor" : "generic";
  }
  return { records, by_id: byId, relations, audit: buildCountryScopeAudit(records, relations) };
}
```

`applyStatisticalGroups()` 只在 `tagged / total >= 0.8` 且并集国家数为 1 至 8 时添加组证据。`propagateCountryScopes()` 用“内容节点—国家—证据起点”作为访问键；当前作用域传播来源国家，明确国家作用域只传播该标签，未知作用域跳过。继承证据保存 `from_kind`、`from_id`、`relation_kind`、`origin_kind`、`origin_id`。

组键按内容类型固定为：事件使用 `namespace`，日志使用 `group`，决议使用 `source_file`。空组键不参加组统计。人工校正的类型字段统一使用 `content_type`，值为 `journal`、`event` 或 `decision`；`content_kind` 只表示最终的 `flavor` 或 `generic`。

- [ ] **Step 5：运行新旧分类测试并确认通过**

Run:

```powershell
node scripts/check_content_country_scope_unit.mjs
$env:VICTORIA3_VERSION='1.13.10'
try { node scripts/check_event_kind_contract.mjs } finally { Remove-Item Env:VICTORIA3_VERSION -ErrorAction SilentlyContinue }
```

Expected: 两项均 PASS；单元测试输出包含 `parser-ok` 和 `classification-ok`。

- [ ] **Step 6：提交分类与传播实现**

```powershell
git add -- scripts/content_country_scope.mjs scripts/content_country_scope_overrides.mjs scripts/check_content_country_scope_unit.mjs scripts/event_kind.mjs
git commit -m "feat: classify content country scopes"
```

### Task 3：接入 VC 合并构建并生成审计报告

**Files:**
- Modify: `scripts/build_victorian_century_content.mjs`
- Create: `scripts/check_victorian_century_content_country_contract.mjs`
- Generate: `database/victorian_century/journal_entries.json`
- Generate: `database/victorian_century/events.json`
- Generate: `database/victorian_century/decisions.json`
- Generate: `database/victorian_century/content-index.json`
- Generate: `database/victorian_century/content-country-association-audit.json`

- [ ] **Step 1：先写完整数据合同的失败测试**

创建 `scripts/check_victorian_century_content_country_contract.mjs`，验证字段、已知正例、已知反例、国家标签有效性、证据结构和原版基线差异：

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const database = path.join(root, "database", "victorian_century");
const read = (name) => JSON.parse(fs.readFileSync(path.join(database, name), "utf8"));
const journals = read("journal_entries.json");
const events = read("events.json");
const decisions = read("decisions.json");
const countries = new Set(read("countries.json").map((country) => country.tag));
const audit = read("content-country-association-audit.json");
const scopedTags = new Set();

for (const [kind, rows] of [["journal", journals], ["event", events], ["decision", decisions]]) {
  assert.ok(rows.every((row) => Array.isArray(row.country_scope)), `${kind} 缺少 country_scope`);
  assert.ok(rows.every((row) => Array.isArray(row.country_scope_evidence)), `${kind} 缺少证据`);
  assert.ok(rows.every((row) => row.content_kind === (row.country_scope.length ? "flavor" : "generic")), `${kind} content_kind 不一致`);
  rows.flatMap((row) => row.country_scope).forEach((tag) => scopedTags.add(tag));
}

const unresolved = [...scopedTags].filter((tag) => !countries.has(tag)).sort();
assert.deepEqual(unresolved, audit.unresolved_country_tags.map((item) => item.country || item).sort());

assert.deepEqual(journals.find((row) => row.id === "alexander_reform").country_scope, ["RUS"]);
assert.deepEqual(decisions.find((row) => row.id === "aus_integrate_crown_lands_decision").country_scope, ["AUS"]);
assert.ok(!decisions.find((row) => row.id === "decision_demand_hungary_revoke_laws").country_scope.includes("HUN"));
assert.deepEqual(events.find((row) => row.id === "1848.4").country_scope, []);
assert.ok(Array.isArray(audit.unresolved_country_tags));
assert.ok(Array.isArray(audit.invalid_relation_targets));
assert.equal(audit.vanilla_1_13_10_event_baseline.flavor, 836);
assert.ok(Array.isArray(audit.vanilla_1_13_10_event_baseline.reclassified_scopes));

console.log(JSON.stringify({ victorian_century_content_country_contract: "ok", counts: audit.counts }, null, 2));
```

- [ ] **Step 2：运行合同并确认现有数据缺少字段和审计文件**

Run: `node scripts/check_victorian_century_content_country_contract.mjs`

Expected: FAIL，首先报告 `content-country-association-audit.json` 不存在或数据缺少 `country_scope`。

- [ ] **Step 3：在合并完成后执行国家范围分类**

修改 `build_victorian_century_content.mjs`，在本地化校正后、写 JSON 前调用分类器。有效国家来自 `database/victorian_century/countries.json`。把分类结果写回相同对象，同时让事件的 `event_kind` 与 `content_kind` 一致。

```js
import { classifyContentCountryScopes } from "./content_country_scope.mjs";
import { CONTENT_COUNTRY_SCOPE_OVERRIDES, STABLE_EVENT_GROUP_COUNTRIES } from "./content_country_scope_overrides.mjs";

const classification = classifyContentCountryScopes({
  journals: merged.journal_entries,
  events: merged.events,
  decisions: merged.decisions,
  overrides: CONTENT_COUNTRY_SCOPE_OVERRIDES,
  stableEventGroups: STABLE_EVENT_GROUP_COUNTRIES,
});
for (const record of classification.records) {
  record.row.country_scope = record.country_scope;
  record.row.country_scope_evidence = record.country_scope_evidence;
  record.row.content_kind = record.content_kind;
  if (record.kind === "event") record.row.event_kind = record.content_kind;
}
```

在审计对象中加入三类总数、风味数量、四种证据数量、无法解析标签、组冲突、无效目标、关系数量、人工校正数量。加载 `site/versions/1.13.10/data-events.js` 的 `window.VIC3_DATA_CHUNK.events` 作为原版事件基线，确认其 836 条风味事件统计未损坏。旧基线按脚本内任意国家标签判定，主体国家新规则更严格，因此逐条范围变化写入 `vanilla_1_13_10_event_baseline.reclassified_scopes` 供审计，不把旧启发式标签当成新分类必须保留的主体国家。

- [ ] **Step 4：重建 VC 内容数据库**

Run: `node scripts/build_victorian_century_content.mjs`

Expected: PASS，输出包含日志 857、事件 2946、决议 102，并新增国家范围统计；生成 `content-country-association-audit.json`。日志数量包含此前漏读的 `REPLACE_OR_CREATE` 定义。

- [ ] **Step 5：运行完整合同和既有内容合同**

Run:

```powershell
node scripts/check_content_country_scope_unit.mjs
node scripts/check_victorian_century_content_country_contract.mjs
node scripts/check_victorian_century_content_contract.mjs
node scripts/check_victorian_century_content_change_contract.mjs
```

Expected: 四项均 PASS，既有 VC 新增和调整计数保持不变。

- [ ] **Step 6：提交构建逻辑、检查和生成数据**

```powershell
git add -- scripts/build_victorian_century_content.mjs scripts/check_victorian_century_content_country_contract.mjs database/victorian_century/journal_entries.json database/victorian_century/events.json database/victorian_century/decisions.json database/victorian_century/content-index.json database/victorian_century/content-country-association-audit.json
git commit -m "feat: generate VC content country associations"
```

### Task 4：生成国家反向索引并写入站点内容块

**Files:**
- Modify: `scripts/content_country_scope.mjs`
- Modify: `scripts/build_victorian_century_content_site_data.mjs`
- Modify: `scripts/check_victorian_century_content_country_contract.mjs`
- Modify: `scripts/check_victorian_century_standalone_site.mjs`
- Generate: `Victorian Century Database/data-content.js`
- Generate: `Victorian Century Database/data-index.js`
- Generate: `site/vc/data-content.js`
- Generate: `site/vc/data-index.js`

- [ ] **Step 1：增加正向范围与反向索引一致性失败测试**

在数据合同中读取独立站 `data-content.js`，验证 `contentByCountry` 的每个 ID 都能回查到对应国家，且每个有效 `country_scope` 都存在反向项：

```js
import vm from "node:vm";
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "Victorian Century Database", "data-content.js"), "utf8"), sandbox);
const chunk = sandbox.window.VIC3_DATA_CHUNK;

for (const [kind, field, idField] of [
  ["journals", "journalEntries", "id"],
  ["events", "contentEvents", "id"],
  ["decisions", "decisions", "id"],
]) {
  const byId = new Map(chunk[field].map((row) => [row[idField], row]));
  for (const row of chunk[field]) for (const tag of row.country_scope) {
    assert.ok(chunk.contentByCountry[tag][kind].includes(row[idField]), `${tag}/${kind}/${row[idField]} 缺少反向索引`);
  }
  for (const [tag, bucket] of Object.entries(chunk.contentByCountry)) for (const id of bucket[kind]) {
    assert.ok(byId.get(id)?.country_scope.includes(tag), `${tag}/${kind}/${id} 与正向范围不一致`);
  }
}
```

- [ ] **Step 2：运行合同并确认站点块缺少反向索引**

Run: `node scripts/check_victorian_century_content_country_contract.mjs`

Expected: FAIL，错误指向 `contentByCountry` 不存在。

- [ ] **Step 3：实现反向索引并写入内容块**

在 `content_country_scope.mjs` 中实现纯函数：

```js
export function buildContentByCountry({ journals = [], events = [], decisions = [] }, validCountryTags = null) {
  const result = {};
  for (const [bucket, rows] of [["journals", journals], ["events", events], ["decisions", decisions]]) {
    for (const row of rows) for (const tag of row.country_scope || []) {
      if (validCountryTags && !validCountryTags.has(tag)) continue;
      result[tag] ||= { journals: [], events: [], decisions: [] };
      result[tag][bucket].push(row.id);
    }
  }
  for (const bucket of Object.values(result)) for (const key of ["journals", "events", "decisions"]) {
    bucket[key] = [...new Set(bucket[key])].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  }
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)));
}
```

修改 `build_victorian_century_content_site_data.mjs`，读取 `countries.json`，向 `value` 增加 `contentByCountry`，并在内容块计数中增加 `countriesWithContent`。

```js
import { buildContentByCountry } from "./content_country_scope.mjs";

const countries = rows("countries");
const validCountryTags = new Set(countries.map((country) => country.tag));
value.contentByCountry = buildContentByCountry({
  journals: value.journalEntries,
  events: value.contentEvents,
  decisions: value.decisions,
}, validCountryTags);
```

- [ ] **Step 4：重建独立站和发布副本**

Run:

```powershell
node scripts/build_victorian_century_site.mjs --source site --target "Victorian Century Database" --publish-target site/vc --vc-database database/victorian_century --skip-vc-assets
```

Expected: PASS，`data-content.js` 含 `contentByCountry`，独立站和 `site/vc` 的数据块哈希一致。

- [ ] **Step 5：运行数据与独立站检查**

Run:

```powershell
node scripts/check_victorian_century_content_country_contract.mjs
node scripts/check_victorian_century_standalone_site.mjs
```

Expected: 两项均 PASS；独立站检查确认内容块存在反向索引及三类计数。

- [ ] **Step 6：提交反向索引和构建产物**

```powershell
git add -- scripts/content_country_scope.mjs scripts/build_victorian_century_content_site_data.mjs scripts/check_victorian_century_content_country_contract.mjs scripts/check_victorian_century_standalone_site.mjs "Victorian Century Database/data-content.js" "Victorian Century Database/data-index.js" site/vc/data-content.js site/vc/data-index.js
git commit -m "feat: publish country content reverse index"
```

### Task 5：加载关联数据并建立共用前端组件

**Files:**
- Create: `site/app/content-country-links.js`
- Modify: `site/app/runtime.js`
- Modify: `site/app/data.js`
- Modify: `site/index.html`
- Modify: `scripts/site_frontend_sources.mjs`
- Modify: `scripts/check_victorian_century_standalone_site.mjs`
- Test: `scripts/check_victorian_century_content_browser.mjs`

- [ ] **Step 1：写关联组件和数据加载的失败浏览器断言**

在 `check_victorian_century_content_browser.mjs` 开头进入一个已关联事件详情，并检查国家按钮；再直接打开国家页，确认内容块随国家视图加载：

```js
await page.goto(`${baseUrl}#/event/acw_events.1`);
await page.waitFor(() => Boolean(document.querySelector(".event-detail [data-related-country]")), "event related countries");
assert.ok(await page.evaluate(() => document.querySelectorAll("[data-related-country]").length > 0));

await page.goto(`${baseUrl}#/country/GBR`);
await page.waitFor(() => typeof contentByCountry !== "undefined" && Boolean(contentByCountry.GBR), "country content index");
```

- [ ] **Step 2：运行浏览器检查并确认组件和运行时字段缺失**

Run: `node scripts/check_victorian_century_content_browser.mjs`

Expected: FAIL，等待 `data-related-country` 或 `contentByCountry.GBR` 超时。

- [ ] **Step 3：接入内容块与国家块的双向依赖**

在 `runtime.js` 增加：

```js
let contentByCountry = {};
```

在 `applyLoadedDataset()` 增加：

```js
contentByCountry = data.contentByCountry || {};
```

修改 `dataChunksForView()`：国家视图增加 `content`；事件视图增加 `country`；日志和决议加载 `content` 与 `country`。

```js
if (view === "country") return ["country", "culture", "region", "ideology", "law", "content"];
if (view === "event") return standaloneSiteConfig ? ["content", "country"] : ["event", "country"];
if (view === "journal" || view === "decision") return ["content", "country"];
```

- [ ] **Step 4：创建共用国家关联组件**

新增 `site/app/content-country-links.js`，组件使用普通哈希链接，不增加专用点击监听：

```js
function relatedCountriesHtml(row) {
  const tags = (row?.country_scope || []).filter((tag) => byTag.has(tag));
  if (!tags.length) return "";
  return `<section class="content-related-countries">
    <h3>${escapeHtml(t("board.content.relatedCountries"))}</h3>
    <div class="content-related-country-list">${tags.map(relatedCountryLinkHtml).join("")}</div>
  </section>`;
}

function relatedCountryLinkHtml(tag) {
  const country = byTag.get(tag);
  return `<a class="content-related-country" data-related-country="${escapeHtml(tag)}" href="#/country/${encodeURIComponent(tag)}">
    ${countryFlagIconHtml(country, "content-related-country-flag")}
    <span>${escapeHtml(entityText(country) || tag)}</span>
    <code>${escapeHtml(tag)}</code>
  </a>`;
}
```

在 `site/index.html` 中把新脚本放在 `content-dynamic-text.js` 之后、三个内容板块脚本之前，并加入缓存版本。同步更新 `site_frontend_sources.mjs` 和独立站模块清单。

- [ ] **Step 5：重建站点并运行静态检查**

Run:

```powershell
node scripts/build_victorian_century_site.mjs --source site --target "Victorian Century Database" --publish-target site/vc --vc-database database/victorian_century --skip-vc-assets
node scripts/check_victorian_century_standalone_site.mjs
node --check site/app/content-country-links.js
```

Expected: 三项均 PASS，新模块在主站源、独立站和发布副本中存在。

- [ ] **Step 6：提交运行时和共用组件**

```powershell
git add -- site/app/content-country-links.js site/app/runtime.js site/app/data.js site/index.html scripts/site_frontend_sources.mjs scripts/check_victorian_century_standalone_site.mjs
git commit -m "feat: load shared country content links"
```

### Task 6：在日志、事件和决议详情显示相关国家

**Files:**
- Modify: `site/app/events.js`
- Modify: `site/app/journals.js`
- Modify: `site/app/decisions.js`
- Modify: `scripts/check_victorian_century_content_browser.mjs`
- Modify: `scripts/check_victorian_century_journal_browser.mjs`
- Modify: `scripts/check_victorian_century_decision_browser.mjs`

- [ ] **Step 1：补充三个详情页的失败断言**

事件检查使用 `acw_events.1`，日志检查使用 `alexander_reform`，决议检查使用 `aus_integrate_crown_lands_decision`：

```js
const countries = await page.evaluate(() => [...document.querySelectorAll("[data-related-country]")].map((item) => item.dataset.relatedCountry));
assert.ok(countries.length > 0, "详情必须显示相关国家");
assert.ok(countries.every((tag) => document.querySelector(`[data-related-country='${CSS.escape(tag)}'] img`)), "相关国家必须显示国旗");
```

决议检查额外断言 `decision_demand_hungary_revoke_laws` 的相关国家中有 `AUS` 且没有 `HUN`。通用事件 `1848.4` 不得渲染空白的 `.content-related-countries`。

- [ ] **Step 2：运行三项浏览器检查并确认失败**

Run:

```powershell
node scripts/check_victorian_century_content_browser.mjs
node scripts/check_victorian_century_journal_browser.mjs
node scripts/check_victorian_century_decision_browser.mjs
```

Expected: 至少一项 FAIL，指出内容详情缺少相关国家组件。

- [ ] **Step 3：把共用组件接入三个详情模板**

事件详情删除原来的纯文本 `eventCountryScopeHtml()` 输出，改为在标题和元信息之后插入：

```js
${relatedCountriesHtml(event)}
```

日志和决议详情在 `<div class="content-meta">` 之后插入同一调用：

```js
${relatedCountriesHtml(row)}
```

保留 `eventCountryScopeHtml()` 名称时只让它返回 `relatedCountriesHtml(event)`，避免一次改动留下两套国家范围组件。

- [ ] **Step 4：重建并运行三个浏览器检查**

Run:

```powershell
node scripts/build_victorian_century_site.mjs --source site --target "Victorian Century Database" --publish-target site/vc --vc-database database/victorian_century --skip-vc-assets
node scripts/check_victorian_century_content_browser.mjs
node scripts/check_victorian_century_journal_browser.mjs
node scripts/check_victorian_century_decision_browser.mjs
```

Expected: 四项均 PASS，三个内容详情均显示可点击国家，通用内容没有空白区域。

- [ ] **Step 5：提交三个详情页的关联显示**

```powershell
git add -- site/app/events.js site/app/journals.js site/app/decisions.js scripts/check_victorian_century_content_browser.mjs scripts/check_victorian_century_journal_browser.mjs scripts/check_victorian_century_decision_browser.mjs
git commit -m "feat: show related countries in content details"
```

### Task 7：在国家详情显示风味日志、事件和决议

**Files:**
- Modify: `site/app/content-country-links.js`
- Modify: `site/app/presentation.js`
- Create: `scripts/check_victorian_century_country_content_browser.mjs`

- [ ] **Step 1：写国家详情分区、排序和双向跳转的失败浏览器测试**

创建 `scripts/check_victorian_century_country_content_browser.mjs`。打开英国国家详情，确认三个分区存在、默认收起、没有内部滚动条；点击每类首项后进入对应详情，再点击英国返回国家详情。

```js
await page.goto(`${baseUrl}#/country/GBR`);
await page.waitForSelector(".country-flavor-content", { timeout: 30000 });
assert.equal(await page.locator("[data-country-content-kind]").count(), 3);
assert.deepEqual(await page.locator("[data-country-content-kind]").evaluateAll((nodes) => nodes.map((node) => node.open)), [false, false, false]);
assert.equal(await page.locator(".country-flavor-content").evaluate((node) => getComputedStyle(node).overflowY), "visible");

for (const kind of ["journal", "event", "decision"]) {
  const section = page.locator(`[data-country-content-kind='${kind}']`);
  await section.locator("summary").click();
  const link = section.locator("[data-country-content-link]").first();
  const id = await link.getAttribute("data-country-content-id");
  await link.click();
  await page.waitForURL((url) => url.hash === `#/${kind}/${encodeURIComponent(id)}`);
  await page.locator("[data-related-country='GBR']").click();
  await page.waitForURL((url) => url.hash === "#/country/GBR");
}
```

移动端视口 `442 × 844` 再检查三个分区按日志、事件、决议纵向排列且页面无横向溢出。

- [ ] **Step 2：运行新浏览器检查并确认国家分区缺失**

Run: `node scripts/check_victorian_century_country_content_browser.mjs`

Expected: FAIL，等待 `.country-flavor-content` 超时。

- [ ] **Step 3：实现国家风味内容卡片和分区组件**

在 `content-country-links.js` 中实现按 ID 回查、组名排序与现有 VC 标签复用：

```js
function countryFlavorContentHtml(tag) {
  const bucket = contentByCountry[tag] || { journals: [], events: [], decisions: [] };
  const sections = [
    countryContentSectionHtml("journal", bucket.journals, journalEntries, journalId, journalText, journalGroupName),
    countryContentSectionHtml("event", bucket.events, events, (row) => row.key || row.id, (row) => eventText(row, "title", row.key || row.id), eventGroupTitle),
    countryContentSectionHtml("decision", bucket.decisions, decisions, decisionId, decisionText, decisionGroupLabel),
  ];
  const total = bucket.journals.length + bucket.events.length + bucket.decisions.length;
  if (!total) return "";
  return `<section class="country-flavor-content">
    <h3>${escapeHtml(t("board.country.flavorContent"))}</h3>
    <div class="country-flavor-content-counts">${contentCountPills(bucket)}</div>
    <div class="country-flavor-content-sections">${sections.join("")}</div>
  </section>`;
}
```

`countryContentSectionHtml()` 先按可读组名、数字 ID 排序，再输出默认关闭的 `<details data-country-content-kind>`。每项输出标题、ID、组名、`vc_change_kind` 标签和 `href="#/TYPE/ID"`，并设置 `data-country-content-link`、`data-country-content-id`。

- [ ] **Step 4：在国家详情基础信息之后插入分区**

修改 `renderCountryDetail()`，在基础 `<dl>` 结束后插入：

```js
${countryFlavorContentHtml(country.tag)}
```

保持后续利益集团风味、国名变体、地图色和开局信息顺序不变。

- [ ] **Step 5：重建并运行双向跳转检查**

Run:

```powershell
node scripts/build_victorian_century_site.mjs --source site --target "Victorian Century Database" --publish-target site/vc --vc-database database/victorian_century --skip-vc-assets
node scripts/check_victorian_century_country_content_browser.mjs
node scripts/check_victorian_century_content_browser.mjs
```

Expected: 三项均 PASS；桌面和窄屏双向跳转均能到达正确详情。

- [ ] **Step 6：提交国家详情关联区域**

```powershell
git add -- site/app/content-country-links.js site/app/presentation.js scripts/check_victorian_century_country_content_browser.mjs
git commit -m "feat: add flavor content to country details"
```

### Task 8：补齐双语词条、布局样式和发布清单

**Files:**
- Create: `site/styles/content-associations.css`
- Modify: `site/styles.css`
- Modify: `site/locales/ui.zh-Hans.js`
- Modify: `site/locales/ui.en.js`
- Modify: `scripts/site_frontend_sources.mjs`
- Modify: `scripts/check_publish_bundle.mjs`
- Modify: `scripts/check_victorian_century_standalone_site.mjs`
- Modify: `site/index.html`

- [ ] **Step 1：给浏览器测试加入视觉合同失败断言**

扩展国家关联浏览器测试，检查国旗尺寸、三类区域顺序、标签换行和单一滚动条：

```js
const layout = await page.evaluate(() => ({
  kinds: [...document.querySelectorAll("[data-country-content-kind]")].map((node) => node.dataset.countryContentKind),
  detailOverflow: getComputedStyle(document.querySelector(".detail")).overflowY,
  contentOverflow: getComputedStyle(document.querySelector(".country-flavor-content")).overflowY,
  flagWidth: document.querySelector(".content-related-country-flag")?.getBoundingClientRect().width || 0,
}));
assert.deepEqual(layout.kinds, ["journal", "event", "decision"]);
assert.equal(layout.detailOverflow, "auto");
assert.equal(layout.contentOverflow, "visible");
assert.ok(layout.flagWidth >= 20 && layout.flagWidth <= 32);
```

- [ ] **Step 2：运行检查并确认样式或词条缺失**

Run: `node scripts/check_victorian_century_country_content_browser.mjs`

Expected: FAIL，指出关联组件没有符合合同的样式或词条。

- [ ] **Step 3：增加中英文界面词条**

两份 UI 词条使用相同键：

```js
"board.content.relatedCountries": "相关国家",
"board.country.flavorContent": "风味内容",
"board.country.flavorContent.journals": "日志",
"board.country.flavorContent.events": "事件",
"board.country.flavorContent.decisions": "决议",
"board.country.flavorContent.empty": "没有可靠关联内容",
```

英文值分别为 `Related countries`、`Flavor content`、`Journals`、`Events`、`Decisions`、`No reliably associated content`。

- [ ] **Step 4：创建关联组件样式并接入样式清单**

新增 `content-associations.css`：

```css
.content-related-country-list { display: flex; flex-wrap: wrap; gap: .45rem; }
.content-related-country { display: grid; grid-template-columns: 1.5rem minmax(0, 1fr) auto; align-items: center; gap: .45rem; padding: .4rem .55rem; color: var(--ink); text-decoration: none; background: var(--chip); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); border-radius: .4rem; }
.content-related-country:hover { border-color: var(--accent); background: var(--panel-strong); }
.content-related-country-flag { width: 1.5rem; height: 1rem; object-fit: contain; }
.content-related-country code { color: var(--muted); font-size: .7rem; }
.country-flavor-content { overflow: visible; }
.country-flavor-content-counts { display: flex; flex-wrap: wrap; gap: .35rem; margin-bottom: .65rem; }
.country-flavor-content-sections { display: grid; gap: .55rem; }
.country-content-section { overflow: visible; border: 1px solid var(--line); border-radius: .45rem; background: color-mix(in srgb, var(--panel) 90%, transparent); }
.country-content-section summary { padding: .55rem .7rem; color: var(--accent); cursor: pointer; }
.country-content-list { display: grid; gap: .4rem; padding: 0 .65rem .65rem; }
.country-content-link { display: grid; gap: .2rem; padding: .55rem .65rem; color: var(--ink); text-decoration: none; background: var(--surface); border: 1px solid var(--line); border-radius: .35rem; }
.country-content-link:hover { border-color: var(--accent); }
.country-content-link-meta { display: flex; flex-wrap: wrap; gap: .35rem; color: var(--muted); font-size: .72rem; }
@media (max-width: 1100px) { .country-flavor-content-sections { grid-template-columns: minmax(0, 1fr); } }
```

在 `styles.css` 导入新文件，在 `site_frontend_sources.mjs` 的 `styleSections` 中加入该文件，更新 `index.html` 缓存版本。

- [ ] **Step 5：更新发布与独立站清单并运行检查**

Run:

```powershell
node scripts/build_victorian_century_site.mjs --source site --target "Victorian Century Database" --publish-target site/vc --vc-database database/victorian_century --skip-vc-assets
node scripts/check_victorian_century_country_content_browser.mjs
node scripts/check_victorian_century_standalone_site.mjs
node scripts/check_publish_bundle.mjs
git diff --check
```

Expected: 五项均 PASS，无缺失模块、样式或发布文件。

- [ ] **Step 6：提交样式、本地化和发布合同**

```powershell
git add -- site/styles/content-associations.css site/styles.css site/locales/ui.zh-Hans.js site/locales/ui.en.js scripts/site_frontend_sources.mjs scripts/check_publish_bundle.mjs scripts/check_victorian_century_standalone_site.mjs site/index.html
git commit -m "feat: style country flavor content links"
```

### Task 9：执行完整回归验证并记录结果

**Files:**
- Modify: `docs/worklog/2026-08-16-content-boards.md`
- Verify: `Victorian Century Database/`
- Verify: `site/vc/`

- [ ] **Step 1：运行数据、构建、浏览器和发布完整检查**

Run:

```powershell
node scripts/check_content_country_scope_unit.mjs
node scripts/check_victorian_century_content_country_contract.mjs
node scripts/check_victorian_century_content_contract.mjs
node scripts/check_victorian_century_content_change_contract.mjs
node scripts/check_victorian_century_content_localization.mjs
node scripts/check_victorian_century_content_browser.mjs
node scripts/check_victorian_century_journal_browser.mjs
node scripts/check_victorian_century_decision_browser.mjs
node scripts/check_victorian_century_country_content_browser.mjs
node scripts/check_victorian_century_standalone_site.mjs
node scripts/check_victorian_century_main_entry.mjs
node scripts/check_publish_bundle.mjs
git diff --check
```

Expected: 所有命令退出码为 0；日志 857、事件 2946、决议 102；正反索引一致；三个双向跳转通过；无控制台错误和横向溢出。

- [ ] **Step 2：核对主站源、独立站和发布副本的一致性**

Run:

```powershell
$paths = @(
  @('site/app/content-country-links.js','Victorian Century Database/app/content-country-links.js','site/vc/app/content-country-links.js'),
  @('site/styles/content-associations.css','Victorian Century Database/styles/content-associations.css','site/vc/styles/content-associations.css'),
  @('Victorian Century Database/data-content.js','site/vc/data-content.js')
)
foreach ($group in $paths) {
  $hashes = $group | ForEach-Object { (Get-FileHash -Algorithm SHA256 -LiteralPath $_).Hash }
  if (($hashes | Select-Object -Unique).Count -ne 1) { throw "文件副本不一致：$($group -join ', ')" }
}
```

Expected: 命令无输出并以 0 退出。

- [ ] **Step 3：记录判定数量、审计结果和验证命令**

在 `docs/worklog/2026-08-16-content-boards.md` 追加连续段落，记录三类内容各自的风味数量、直接／组／继承／校正证据数量、关联国家数、未解析标签数、基线标签缺失数、新增关联数、双向跳转和窄屏验证结果。明确本地完成、提交状态、远程推送状态和公开部署状态。

- [ ] **Step 4：提交工作记录**

```powershell
git add -- docs/worklog/2026-08-16-content-boards.md
git commit -m "docs: record country content associations"
```

- [ ] **Step 5：检查最终提交范围**

Run:

```powershell
git status --short --branch
git log --oneline -10
```

Expected: 本功能的提交按任务分开，用户原有的其他未跟踪或未提交文件仍保持原状态；尚未执行推送或公开部署。
