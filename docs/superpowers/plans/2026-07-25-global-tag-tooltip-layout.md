# 通用标签提示框布局实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已有的全站标签提示框实现并入主分支，并使除意识形态外的概念标签采用统一的标题、内容和操作提示布局。

**Architecture:** 先合并 `codex/global-tag-tooltips` 截至 `c0f2b6bf` 的 15 个提交，使普通标签、引用标签和图标标签都具备概念元数据。`site/app/ui.js` 以一套通用渲染函数生成标题、内容和能力提示；文化关系作为内容区的一种数据来源，意识形态继续走独立渲染路径。静态契约锁定结构、能力判定和例外，避免依赖浏览器检查。

**Tech Stack:** 原生 JavaScript、静态 HTML 字符串、CSS、Node.js `assert` 契约脚本与 Git。

---

## 文件结构

`site/app/components.js` 和 `site/app/tag-tooltip-definitions.js` 提供标签的语义键、类别和说明。`site/app/ui.js` 根据标签的数据属性生成提示框。`site/styles/records.css` 提供通用提示框布局。`site/index.html` 与 `site/styles.css` 更新被修改资源的缓存参数。`scripts/check_tag_tooltip_contracts.mjs` 检查标签元数据、通用提示框和意识形态例外。

### Task 1: 合并标签提示框基线

**Files:**

- Modify: 由 `codex/global-tag-tooltips` 合并引入的 `site/app/components.js`、`site/app/tag-tooltip-definitions.js`、`site/app/ui.js`、`site/styles/records.css`、`site/index.html`、`site/styles.css`
- Create: `scripts/check_tag_tooltip_contracts.mjs`

- [ ] **Step 1: 确认待合并分支和独立改动**

Run: `git merge-base 91d67ed3 c0f2b6bf; git diff --name-only 7e1a52ef..91d67ed3; git diff --name-only 7e1a52ef..c0f2b6bf`

Expected: 共同基点为 `7e1a52ef`；主分支独有改动只涉及 `scripts/check_homepage_layout.mjs` 和 `site/app/boards.js`，不与标签提示框文件重叠。

- [ ] **Step 2: 合并既有标签提示框提交**

Run: `git merge --no-ff codex/global-tag-tooltips -m "merge: add global tag tooltips"`

Expected: 合并完成且没有冲突，主分支保留主页时间戳修正，并包含 `c0f2b6bf` 的前置标签元数据、文化关联和静态契约。

- [ ] **Step 3: 运行基线静态检查**

Run: `node --check site/app/components.js; node --check site/app/ui.js; node scripts/check_tag_tooltip_contracts.mjs; node scripts/check_right_panel_layout.mjs; node scripts/check_ui_ideology_contracts.mjs`

Expected: 五个命令均以零状态结束，标签契约输出 `{"tag_tooltip_components":"ok"}`。

### Task 2: 先扩展通用布局契约

**Files:**

- Modify: `scripts/check_tag_tooltip_contracts.mjs`

- [ ] **Step 1: 写入会失败的通用布局断言**

在现有文化提示框断言之后加入以下断言，固定通用函数、通用样式、能力文本与意识形态例外。

```js
assert.match(uiSource, /function\s+conceptTooltipHeader\s*\(/, "generic tooltip header renderer is missing");
assert.match(uiSource, /function\s+conceptTooltipContent\s*\(/, "generic tooltip content renderer is missing");
assert.match(uiSource, /function\s+conceptTooltipActionHints\s*\(/, "generic tooltip action resolver is missing");
assert.match(uiSource, /concept-tooltip-head/, "generic tooltip must render a two-column header");
assert.match(uiSource, /concept-tooltip-divider/, "generic tooltip must separate header, content, and actions");
assert.match(uiSource, /左键进入详情页/, "generic tooltip must name the detail action");
assert.match(uiSource, /右键进行筛选/, "generic tooltip must name the filter action");
assert.match(recordStyles, /\.concept-tooltip\.standard-tooltip\s*{/, "generic tooltip layout is missing");
assert.match(recordStyles, /\.concept-tooltip-head\s*{/, "generic tooltip header style is missing");
assert.match(recordStyles, /\.concept-tooltip-divider\s*{/, "generic tooltip divider style is missing");
assert.doesNotMatch(sourceFunction(uiSource, "ideologyTooltipRows"), /conceptTooltipHeader|conceptTooltipContent/, "ideology tooltip must retain its dedicated layout");
```

在断言前加入与现有 `functionSource` 相同的花括号扫描逻辑，但将首个参数改为待检查的源码字符串：`sourceFunction(uiSource, name)`。`functionSource` 只读取 `components.js`，不能用于检查 `ui.js`。

- [ ] **Step 2: 运行契约并确认失败**

Run: `node scripts/check_tag_tooltip_contracts.mjs`

Expected: 非零状态结束，并报告 `generic tooltip header renderer is missing`。

### Task 3: 实现通用提示框结构与操作能力

**Files:**

- Modify: `site/app/ui.js:297-545`
- Modify: `site/styles/records.css:373-465`
- Modify: `site/index.html`
- Modify: `site/styles.css`

- [ ] **Step 1: 使右键处理仅处理可筛选标签**

将概念右键事件的前置条件改为下列形式，令提示文字与实际交互保持一致。

```js
const target = event.target.closest("[data-concept-key]");
if (!target?.dataset.conceptSearch?.trim()) return;
event.preventDefault();
searchConcept(target);
hideConceptTooltip();
```

- [ ] **Step 2: 用通用标题、内容和能力函数替换文化专用框架**

保留 `cultureTooltipRelationSections` 作为关系数据解析器，将 `cultureTooltipType` 和 `cultureTooltipHeader` 改为以下通用函数，并让 `conceptTooltipRows` 只负责组合三个区段。

```js
function conceptTooltipHeader(target) {
  const label = target.dataset.conceptLabel || target.textContent?.trim() || "";
  const key = target.dataset.conceptKey || "";
  const kind = target.dataset.conceptKind || "";
  const type = target.dataset.conceptCategory || conceptKindLabel(kind);
  return `
    <div class="concept-tooltip-head">
      <div class="concept-tooltip-identity">
        <strong>${escapeHtml(label || key)}</strong>
        <div class="concept-tooltip-key">${escapeHtml(key)}</div>
      </div>
      <div class="concept-tooltip-type">${escapeHtml(type)}</div>
    </div>
  `;
}

function conceptTooltipContent(target, relationSections = "") {
  const label = target.dataset.conceptLabel || target.textContent?.trim() || "";
  const key = target.dataset.conceptKey || "";
  const kind = target.dataset.conceptKind || "";
  const relations = relationSections || cultureTooltipRelationSections(kind, key);
  const description = relations ? "" : conceptTooltipDescription(target, kind, key, label);
  const context = relations ? "" : conceptTooltipContextLine(kind, key);
  const rows = [
    context ? `<span>${escapeHtml(context)}</span>` : "",
    description ? `<span class="concept-tooltip-description">${escapeHtml(description)}</span>` : "",
    relations ? `<div class="concept-tooltip-relations">${relations}</div>` : "",
  ].filter(Boolean).join("");
  return rows ? `<div class="concept-tooltip-content">${rows}</div>` : "";
}

function conceptTooltipActionHints(target) {
  return [
    target.matches("a[href]") ? "左键进入详情页" : "",
    target.dataset.conceptSearch?.trim() ? "右键进行筛选" : "",
  ].filter(Boolean).join("　");
}

function conceptTooltipRows(target, relationSections = "") {
  const content = conceptTooltipContent(target, relationSections);
  const actions = conceptTooltipActionHints(target);
  return [
    conceptTooltipHeader(target),
    content ? `<div class="concept-tooltip-divider"></div>` : "",
    content,
    actions ? `<div class="concept-tooltip-divider"></div>` : "",
    actions ? `<small class="concept-tooltip-actions">${escapeHtml(actions)}</small>` : "",
  ].filter(Boolean).join("");
}
```

在 `showConceptTooltip` 中按 `!isIdeology` 切换 `standard-tooltip`，并在 `hideConceptTooltip` 中移除该类。意识形态继续只调用 `ideologyTooltipRows`。

- [ ] **Step 3: 将文化专用样式改为通用样式**

将 `culture-tooltip` 前缀替换为 `concept-tooltip` 通用前缀，保留宽度、滚动和两列标题的数值；内容容器使用网格间距，说明文字使用正文颜色。

```css
.concept-tooltip.standard-tooltip {
  display: block;
  width: min(420px, calc(100vw - 28px));
  max-width: none;
  max-height: min(70vh, 480px);
  overflow-y: auto;
}

.concept-tooltip-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(104px, 0.45fr);
  align-items: center;
  gap: 12px;
}

.concept-tooltip-divider {
  height: 1px;
  margin: 10px 0;
  background: rgba(200, 164, 91, 0.24);
}

.concept-tooltip-content,
.concept-tooltip-relations {
  display: grid;
  gap: 10px;
}

.concept-tooltip .concept-tooltip-description {
  color: var(--ink);
}
```

为标题 ID、类型和操作提示沿用原文化提示框的字体、颜色与换行规则，并从 CSS 中删除不再使用的 `.culture-tooltip-*` 选择器。

- [ ] **Step 4: 更新缓存参数**

将 `site/index.html` 中 `styles.css` 和 `app/ui.js` 的查询参数改为 `v=20260725-global-tag-layout1`，并将 `site/styles.css` 中 `records.css` 的查询参数改为同一版本号。

- [ ] **Step 5: 运行扩展契约并确认通过**

Run: `node --check site/app/ui.js; node scripts/check_tag_tooltip_contracts.mjs`

Expected: 两个命令均以零状态结束，标签契约输出 `{"tag_tooltip_components":"ok"}`。

- [ ] **Step 6: 提交通用布局改动**

```bash
git add site/app/ui.js site/styles/records.css site/index.html site/styles.css scripts/check_tag_tooltip_contracts.mjs
git commit -m "feat: unify tag tooltip layout"
```

### Task 4: 运行完整静态回归并记录结果

**Files:**

- Create: `docs/worklog/2026-07-25.md`
- Modify: `WORKLOG.md`

- [ ] **Step 1: 运行指定静态检查**

Run: `node --check site/app/components.js; node --check site/app/ui.js; node scripts/check_tag_tooltip_contracts.mjs; node scripts/check_right_panel_layout.mjs; node scripts/check_ui_ideology_contracts.mjs; node scripts/check_frontend_file_split.mjs`

Expected: 全部以零状态结束；依次包含 `tag_tooltip_components: "ok"`、`right_panel_layout: "ok"`、`ui_ideology_contracts: "ok"` 和 `frontend_file_split: "ok"`。不启动本地服务器或浏览器。

- [ ] **Step 2: 记录已合并基线、布局规则和静态验证**

在 `docs/worklog/2026-07-25.md` 记录合并提交、通用标题和动作提示规则、意识形态例外、实际运行的六条静态检查及结果；在 `WORKLOG.md` 的当前状态与详细记录中添加该文件链接。

- [ ] **Step 3: 提交工作记录**

```bash
git add WORKLOG.md docs/worklog/2026-07-25.md
git commit -m "docs: record universal tag tooltip layout"
```
