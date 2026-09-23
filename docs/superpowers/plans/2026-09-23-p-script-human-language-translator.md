# P语言中文解读器实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为日志、事件和决议详情页生成可重复构建的 P语言中文解读，并提供纯原始脚本、注释交错、纯中文解读三个页签。

**Architecture:** 构建端使用保真解析器把原始脚本转换为带行号的语法树，再由共享语义解释器追踪作用域、解析实体引用、关联官方简体中文本地化并应用人工覆盖。站点数据保存结构化解释结果，浏览器中的共享渲染器负责三个页签、实体跳转和独立证据徽标。

**Tech Stack:** Node.js ES modules、现有原生浏览器 JavaScript、现有静态数据块、Playwright 浏览器检查、Node `assert` 契约检查。

**Spec:** `docs/superpowers/specs/2026-09-23-p-script-human-language-translator-design.md`

## Global Constraints

- 第一版只处理数据库已有的日志、事件和决议，不提供任意代码粘贴工具。
- 构建时确定性生成，不在浏览器运行时调用大模型。
- 原始脚本必须逐字保留，解释数据不能覆盖 `raw` 或现有脚本字段。
- 官方简体中文本地化优先；缺少可靠名称时保留内部键。
- 证据徽标、实体引用和注释文本必须分开存储和渲染。
- `save_scope_as`、`save_temporary_scope_as`、变量和 `show_as_tooltip` 必须按设计规格区分。
- 任何无法确认的运行时语义必须标记为运行未确认。
- 人工覆盖失效、强制实体引用不存在、结构级解析失败必须使检查失败。
- 现有原版、Victorian Century 和多语言构建均需保持可用；不得手工修改忽略的生成副本。

## 文件结构

- `scripts/lib/p-script-parser.mjs`：保真分词、语法树、稳定节点标识和源码行映射。
- `scripts/lib/p-script-semantics.mjs`：顶层结构词典、作用域追踪、逻辑块与常用触发器/效果解释。
- `scripts/lib/p-script-references.mjs`：实体目录、本地化解析、现有详情路由映射。
- `scripts/lib/p-script-overrides.mjs`：人工覆盖加载、匹配、应用和失效报告。
- `scripts/p-script-interpretation-overrides.json`：经过审查的人工覆盖数据，首个样例为 `je_brazilian_nation_building`。
- `scripts/build_p_script_interpretations.mjs`：为日志、事件和决议生成解释并返回构建报告。
- `site/app/script-interpreter.js`：三个页签、源码行、实体标记、证据徽标和复制功能的共享渲染器。
- `site/styles/script-interpreter.css`：桌面和窄屏布局。
- `scripts/check_p_script_parser.mjs`、`scripts/check_p_script_semantics.mjs`、`scripts/check_p_script_build.mjs`、`scripts/check_p_script_interpreter_browser.mjs`：分层验证。

---

### Task 1: 保真 P语言解析器

**Files:**
- Create: `scripts/lib/p-script-parser.mjs`
- Create: `scripts/check_p_script_parser.mjs`

**Interfaces:**
- Produces: `parsePScript(source, { file, startLine, objectKind, objectKey }) -> ParsedScript`
- Produces: `ParsedScript = { source, lines, root, diagnostics }`
- Produces: 每个 AST 节点包含 `id`, `kind`, `key`, `operator`, `value`, `children`, `source.file`, `source.line`, `source.endLine`, `raw`, `indent`, `occurrence`。

- [ ] **Step 1: 写入解析器失败测试**

在 `scripts/check_p_script_parser.mjs` 中使用 Node `assert` 覆盖以下真实语法：

```js
import assert from "node:assert/strict";
import { parsePScript } from "./lib/p-script-parser.mjs";

const source = `complete = {
  cu:brazilian.culture_current_fervor >= 65
  custom_tooltip = { text = key has_variable = integrated }
  s:STATE_BOMBAY ?= { any_scope_state = { owner = ROOT } }
  scripted_button = one
  scripted_button = two
}`;
const parsed = parsePScript(source, {
  file: "fixture.txt",
  startLine: 20,
  objectKind: "journal",
  objectKey: "fixture",
});
assert.equal(parsed.lines.join("\n"), source);
assert.equal(parsed.root.children[0].key, "complete");
assert.equal(parsed.root.children[0].children[0].operator, ">=");
assert.equal(parsed.root.children[0].children[2].operator, "?=");
assert.equal(parsed.root.children[0].children.filter((node) => node.key === "scripted_button").length, 2);
assert.equal(parsed.root.children[0].source.line, 20);
assert.notEqual(parsed.root.children[0].children[3].id, parsed.root.children[0].children[4].id);
```

另加带引号键、匿名块、`rgb {}`、行内注释、字符串中的 `#`、列表项、空块和未闭合块诊断断言。

- [ ] **Step 2: 运行测试并确认按预期失败**

Run: `node scripts/check_p_script_parser.mjs`

Expected: FAIL，错误为找不到 `scripts/lib/p-script-parser.mjs` 或 `parsePScript` 未定义。

- [ ] **Step 3: 实现最小保真分词器和解析器**

解析器按字符扫描并保留 trivia，不使用删除注释后的文本作为输出。稳定节点标识采用：

```js
const id = [objectKind, objectKey, path.join("/"), occurrence, sha256(raw).slice(0, 12)].join(":");
```

重复字段增加 `occurrence`，匿名块路径使用 `[]:<index>`。结构错误写入 `diagnostics`，同时保留能够恢复的原始行。

- [ ] **Step 4: 运行解析器测试**

Run: `node scripts/check_p_script_parser.mjs`

Expected: `p_script_parser: ok`

- [ ] **Step 5: 提交解析器**

```powershell
git add -- scripts/lib/p-script-parser.mjs scripts/check_p_script_parser.mjs
git commit -m "feat: add lossless p-script parser"
```

### Task 2: 语义节点、作用域和标准中文术语

**Files:**
- Create: `scripts/lib/p-script-semantics.mjs`
- Create: `scripts/check_p_script_semantics.mjs`
- Modify: `scripts/lib/p-script-parser.mjs`

**Interfaces:**
- Consumes: `ParsedScript` from Task 1。
- Produces: `interpretPScript(parsed, context) -> ScriptInterpretation`
- Produces: `ScriptInterpretation = { schema, objectKind, objectKey, sections, lines, report }`
- Produces: `InterpretationLine = { sourceLine, raw, annotation, scopes, references, evidence, confidence, nodeId }`

- [ ] **Step 1: 写入作用域与逻辑失败测试**

测试必须使用 `je_brazilian_nation_building` 的缩小样例，并断言：

```js
const interpretation = interpretPScript(parsed, {
  objectKind: "journal",
  objectKey: "je_brazilian_nation_building",
  rootKind: "country",
  locale: "zh-Hans",
  references: emptyReferenceCatalog(),
});
assert.match(line("save_scope_as").annotation.text, /命名作用域/);
assert.doesNotMatch(line("save_scope_as").annotation.text, /变量/);
assert.equal(line("show_as_tooltip").annotation.execution, "display-only");
assert.equal(line("has_variable").scopes.currentKind, "country");
assert.equal(line("OR").annotation.logic, "any");
assert.equal(line("NOR").annotation.logic, "none");
assert.equal(line("s:STATE_BOMBAY ?=").annotation.scopeEntry, "if-exists");
```

再覆盖 `ROOT`、`THIS`、`PREV`、`scope:name`、`global_var:name`、普通条件块的“全部成立”、`count >= 2` 对内部全部条件的计数。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node scripts/check_p_script_semantics.mjs`

Expected: FAIL，错误为语义模块不存在。

- [ ] **Step 3: 实现对象结构词典和作用域栈**

对象结构词典至少包含：

```js
export const OBJECT_SECTION_RULES = {
  journal: {
    is_shown_in_lobby: "显示条件",
    is_shown_when_inactive: "未激活时显示条件",
    immediate: "启动效果",
    complete: "完成条件",
    on_complete: "完成效果",
    fail: "失败条件",
    on_fail: "失败效果",
    timeout: "超时期限",
    on_timeout: "超时处理",
    scripted_button: "交互按钮",
  },
  event: { trigger: "触发条件", immediate: "立即效果", option: "选项" },
  decision: { is_shown: "显示条件", possible: "执行条件", when_taken: "执行效果", ai_chance: "人工智能概率" },
};
```

作用域规则单独维护。实体前缀 `c:`, `cu:`, `s:`, `law_type:`, `technology:` 进入已知对象类型；迭代器和对象链接更新当前作用域；无法确认时保持 `unknown` 并产生 `static-inference` 或 `runtime-unconfirmed` 证据。

- [ ] **Step 4: 实现标准注释词典**

第一版必须覆盖：`save_scope_as`、`save_temporary_scope_as`、`set_variable`、`set_global_variable`、`has_variable`、`exists`、`has_technology_researched`、`has_journal_entry`、`trigger_event`、`add_modifier`、`show_as_tooltip`、`custom_tooltip`、`any_scope_state`、`every_scope_state`、`count`、`OR`、`NOR`、`NOT`、`NAND`、`if`、`else_if`、`else`。

- [ ] **Step 5: 运行语义测试**

Run: `node scripts/check_p_script_semantics.mjs`

Expected: `p_script_semantics: ok`

- [ ] **Step 6: 提交语义核心**

```powershell
git add -- scripts/lib/p-script-parser.mjs scripts/lib/p-script-semantics.mjs scripts/check_p_script_semantics.mjs
git commit -m "feat: interpret p-script scopes and semantics"
```

### Task 3: 官方本地化、实体引用和内部键目录

**Files:**
- Create: `scripts/lib/p-script-references.mjs`
- Create: `scripts/check_p_script_references.mjs`
- Modify: `scripts/lib/p-script-semantics.mjs`

**Interfaces:**
- Produces: `buildReferenceCatalog({ databaseRoot, gameRoot, locale }) -> ReferenceCatalog`
- Produces: `resolveReference(rawKey, expectedKind, catalog) -> EntityReference | null`
- Produces: `EntityReference = { kind, key, label, href, internalKey }`
- Produces: `resolveInternalKey(key) -> { kind, label, docsHref }`

- [ ] **Step 1: 写入实体解析失败测试**

使用临时数据库夹具或当前 `database/vic3_1.13.11`，断言：

```js
assert.deepEqual(resolveReference("nationalism", "technology", catalog), {
  kind: "technology",
  key: "nationalism",
  label: "民族主义",
  href: "#/technology/nationalism",
  internalKey: "nationalism",
});
assert.equal(resolveReference("BRZ", "country", catalog).href, "#/country/BRZ");
assert.equal(resolveReference("brazilian", "culture", catalog).href, "#/culture/brazilian");
assert.equal(resolveReference("STATE_BOMBAY", "stateRegion", catalog).href, "#/state-region/STATE_BOMBAY");
assert.equal(resolveReference("missing_key", "technology", catalog), null);
assert.equal(resolveInternalKey("save_scope_as").kind, "effect");
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node scripts/check_p_script_references.mjs`

Expected: FAIL，错误为引用模块不存在。

- [ ] **Step 3: 实现实体目录**

复用数据库 JSON 和现有官方本地化解析函数。路由必须与 `site/app/components.js` 的 `conceptHref` 一致；无法链接的已知对象仍返回不可点击引用。禁止根据英文键自动生成专有中文名。

- [ ] **Step 4: 实现内部键目录**

内部键记录类型、固定中文释义和语法说明页锚点。语义解释器把注释文字中的对象位置替换为结构化 `references`，文字仍保留可独立阅读的中文。

- [ ] **Step 5: 运行引用测试和现有本地化契约**

Run:

```powershell
node scripts/check_p_script_references.mjs
node scripts/check_multilingual_ui_contracts.mjs
```

Expected: 两项均通过。

- [ ] **Step 6: 提交引用层**

```powershell
git add -- scripts/lib/p-script-references.mjs scripts/lib/p-script-semantics.mjs scripts/check_p_script_references.mjs
git commit -m "feat: link p-script entities and internal keys"
```

### Task 4: 人工覆盖和构建报告

**Files:**
- Create: `scripts/lib/p-script-overrides.mjs`
- Create: `scripts/p-script-interpretation-overrides.json`
- Create: `scripts/check_p_script_overrides.mjs`
- Modify: `scripts/lib/p-script-semantics.mjs`

**Interfaces:**
- Produces: `loadInterpretationOverrides(file) -> OverrideCatalog`
- Produces: `applyInterpretationOverrides(interpretation, catalog) -> { interpretation, report }`
- Produces: `report = { applied, stale, invalidReferences, byEvidence }`

- [ ] **Step 1: 写入覆盖匹配失败测试**

夹具包含一个有效覆盖、一个失效节点和一个强制无效科技引用。测试断言有效覆盖更换注释但不修改原文；失效节点和无效引用进入报告；严格模式抛出包含对象键和节点标识的错误。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node scripts/check_p_script_overrides.mjs`

Expected: FAIL，错误为覆盖模块不存在。

- [ ] **Step 3: 实现覆盖加载与稳定匹配**

覆盖格式固定为：

```json
{
  "schema": "vic3-p-script-overrides/v1",
  "objects": {
    "journal:je_brazilian_nation_building": {
      "nodes": {
        "complete/has_technology_researched#1": {
          "text": "已研究“民族主义”科技",
          "evidence": "official-localization",
          "references": [{ "kind": "technology", "key": "nationalism" }]
        }
      }
    }
  }
}
```

匹配顺序为稳定节点标识、字段路径加出现序号、内容摘要。行号只用于报告。

- [ ] **Step 4: 写入巴西日志样例覆盖**

覆盖只处理规则解释器尚不能可靠生成的叙事句和运行边界，不能复制整份自动结果。必须包含 `show_as_tooltip` 的显示语义、`long_modifier_time = 3650` 的10年引用和 `weight` 的目标追踪器说明依据。

- [ ] **Step 5: 运行覆盖测试**

Run: `node scripts/check_p_script_overrides.mjs`

Expected: `p_script_overrides: ok`

- [ ] **Step 6: 提交覆盖机制**

```powershell
git add -- scripts/lib/p-script-overrides.mjs scripts/lib/p-script-semantics.mjs scripts/p-script-interpretation-overrides.json scripts/check_p_script_overrides.mjs
git commit -m "feat: add p-script interpretation overrides"
```

### Task 5: 日志、事件和决议构建集成

**Files:**
- Create: `scripts/build_p_script_interpretations.mjs`
- Create: `scripts/check_p_script_build.mjs`
- Modify: `scripts/build_content_data.mjs`
- Modify: `scripts/build_event_site_data.mjs`
- Modify: `scripts/build_vanilla_content_site_data.mjs`
- Modify: `scripts/build_victorian_century_content_site_data.mjs`

**Interfaces:**
- Consumes: database rows containing `raw`, source file and source line。
- Produces: each row gains `script_interpretation` with schema `vic3-p-script-interpretation/v1`。
- Produces: build report at `database/vic3_<version>/p-script-interpretation-report.json`。

- [ ] **Step 1: 写入构建失败测试**

在临时输出目录运行构建器，只输入一个日志、一个事件和一个决议夹具。断言三者均有解释数据，原始 `raw` 不变，巴西日志包含三个视图所需的源码行、语义章节和实体引用，报告统计总行数与解释状态之和一致。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node scripts/check_p_script_build.mjs`

Expected: FAIL，错误为构建器不存在或缺少 `script_interpretation`。

- [ ] **Step 3: 实现共享构建器**

`build_p_script_interpretations.mjs` 导出：

```js
export function attachScriptInterpretations({ journals, events, decisions, databaseRoot, gameRoot, locale, overridesFile, strict }) {}
```

日志使用完整 `raw`；事件把触发、立即效果和每个选项组合为带原始来源行的虚拟文档；决议使用完整 `raw`。解释器失败时保留原文并写诊断，严格错误按规格终止构建。

- [ ] **Step 4: 接入原版与 Victorian Century 构建**

原版构建使用原版本地化目录；Victorian Century 构建优先模组本地化，缺失时沿用已有原版本地化回退。解释数据写入共享内容数据块和事件数据块，不新建浏览器请求。

- [ ] **Step 5: 运行构建契约**

Run:

```powershell
node scripts/check_p_script_build.mjs
node scripts/check_content_extraction.mjs
node scripts/check_victorian_century_content_contract.mjs
node scripts/check_versioned_content_builds.mjs
```

Expected: 全部通过；报告无失效覆盖和强制无效引用。

- [ ] **Step 6: 提交构建集成**

```powershell
git add -- scripts/build_p_script_interpretations.mjs scripts/check_p_script_build.mjs scripts/build_content_data.mjs scripts/build_event_site_data.mjs scripts/build_vanilla_content_site_data.mjs scripts/build_victorian_century_content_site_data.mjs
git commit -m "feat: build p-script interpretations"
```

### Task 6: 三页签共享浏览器渲染器

**Files:**
- Create: `site/app/script-interpreter.js`
- Create: `site/styles/script-interpreter.css`
- Create: `scripts/check_p_script_renderer_contract.mjs`
- Modify: `site/app/events.js`
- Modify: `site/app/journals.js`
- Modify: `site/app/decisions.js`
- Modify: `site/index.html`
- Modify: `site/vc/index.html`
- Modify: `Victorian Century Database/index.html`

**Interfaces:**
- Produces: `scriptInterpreterHtml({ interpretation, raw, objectKind, objectKey }) -> string`
- Produces: `bindScriptInterpreter(root)` for tabs, copy actions and evidence popovers。
- Reuses: `conceptPill` and `conceptHref` for linked entities。

- [ ] **Step 1: 写入渲染契约失败测试**

静态契约断言共享渲染器输出三个 `role="tab"`，存在原始、交错、中文三个面板；证据为独立元素；民族主义引用的 `href` 为 `#/technology/nationalism`；交错视图源码行和注释为不同子元素；复制注释版调用 P语言注释序列化函数。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node scripts/check_p_script_renderer_contract.mjs`

Expected: FAIL，错误为渲染器文件不存在。

- [ ] **Step 3: 实现共享渲染器**

三个页签使用 `role="tablist"`, `role="tab"`, `role="tabpanel"` 与正确的 `aria-selected`、`aria-controls`。证据徽标使用 `data-script-evidence`，实体标记使用现有胶囊。未解析节点显示独立“未解析”徽标并保留原文。

- [ ] **Step 4: 实现复制行为**

纯原文复制 `raw`。注释版按原行输出，在行尾或块末追加 `# 中文注释`；实体与证据徽标不进入复制文本。纯中文复制连续中文和内部键，不复制 HTML。

- [ ] **Step 5: 接入三个详情页**

替换日志、事件和决议详情页中重复的原始 `<pre>` 区域。旧字段级条件区块保留作为详情摘要，源码区统一由解释器页签承载。没有解释数据时仍显示纯原始脚本，并把另两个页签标记为暂无解释。

- [ ] **Step 6: 添加样式与缓存版本**

桌面交错视图使用代码和注释双栏；窄屏改为源码在上、注释在下。证据徽标不能进入等宽代码区域。新增脚本和样式需在三个入口页使用相同版本参数。

- [ ] **Step 7: 运行静态契约**

Run:

```powershell
node scripts/check_p_script_renderer_contract.mjs
node --check site/app/script-interpreter.js
node --check site/app/events.js
node --check site/app/journals.js
node --check site/app/decisions.js
node scripts/check_versioned_content_builds.mjs
```

Expected: 全部通过。

- [ ] **Step 8: 提交前端渲染**

```powershell
git add -- site/app/script-interpreter.js site/styles/script-interpreter.css site/app/events.js site/app/journals.js site/app/decisions.js site/index.html site/vc/index.html 'Victorian Century Database/index.html' scripts/check_p_script_renderer_contract.mjs
git commit -m "feat: add p-script interpretation tabs"
```

### Task 7: 浏览器验收、样例覆盖与文档

**Files:**
- Create: `scripts/check_p_script_interpreter_browser.mjs`
- Modify: `scripts/p-script-interpretation-overrides.json`
- Modify: `docs/worklog/2026-09-02-vic3-script-language-study.md`
- Modify: `docs/worklog/2026-09-22-vic3-script-study-next-handoff.md`

**Interfaces:**
- Consumes: generated site data and browser UI from Tasks 5–6。
- Produces: repeatable browser evidence for journal, event and decision pages。

- [ ] **Step 1: 写入浏览器验收脚本**

脚本启动本地静态服务器，依次打开：

```text
#/journal/je_brazilian_nation_building
#/event/culture_brazil.2
#/decision/revive_olympic_games_decision
```

测试断言三个页签可切换；原文含原始键；交错页中 `save_scope_as` 显示命名作用域、`show_as_tooltip` 显示“只在提示中展示”；民族主义胶囊点击后进入科技详情；`revive_olympic_games_decision` 中 `organized_sports` 显示官方中文科技名并链接 `#/technology/organized_sports`；证据徽标存在且不在代码文本中；中文页包含“完成条件”和“超时处理”；复制文本不含徽标文字。

- [ ] **Step 2: 运行浏览器测试并确认失败**

Run: `node scripts/check_p_script_interpreter_browser.mjs`

Expected: FAIL，直到构建数据和页面交互全部接通。

- [ ] **Step 3: 补齐巴西日志、一个事件和一个决议的人工覆盖**

覆盖只修正规则无法可靠表达的节点。每项写明证据来源；运行未确认项使用独立证据标记。不得把整篇中文说明硬编码进覆盖文件。

- [ ] **Step 4: 完成桌面与移动端浏览器验证**

Run:

```powershell
node scripts/check_p_script_interpreter_browser.mjs
node scripts/check_event_board_browser.mjs
node scripts/check_content_board_interactions.mjs
node scripts/check_victorian_century_content_browser.mjs
```

Expected: 全部通过。浏览器检查至少覆盖桌面视口和 442×844 视口。

- [ ] **Step 5: 更新研究记录与交接**

记录解释器的数据格式、覆盖文件、测试命令、第一版支持范围和仍未解释的语法比例。明确静态解释不能替代引擎运行证据。

- [ ] **Step 6: 运行最终验证**

Run:

```powershell
node scripts/check_p_script_parser.mjs
node scripts/check_p_script_semantics.mjs
node scripts/check_p_script_references.mjs
node scripts/check_p_script_overrides.mjs
node scripts/check_p_script_build.mjs
node scripts/check_p_script_renderer_contract.mjs
node scripts/check_p_script_interpreter_browser.mjs
git diff --check
```

Expected: 所有检查通过，构建报告无失效覆盖和强制无效引用。

- [ ] **Step 7: 提交验收与记录**

```powershell
git add -- scripts/check_p_script_interpreter_browser.mjs scripts/p-script-interpretation-overrides.json docs/worklog/2026-09-02-vic3-script-language-study.md docs/worklog/2026-09-22-vic3-script-study-next-handoff.md
git commit -m "test: verify p-script Chinese interpreter"
```
