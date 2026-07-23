# 文化类关系悬停 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让文化相关标签在悬停时完整显示直接关联的数据，并避免在悬停框内触发第二层概念悬停。

**Architecture:** `components.js` 继续提供文化概念的种类和稳定键；`ui.js` 使用已加载的文化、特质和国家数据生成纯文本关系分区；`tag-tooltip-definitions.js` 保存分区标题与空值文案。文化关系内容不使用概念标签、链接或原生标题。静态脚本同时验证代码契约和 1.13.9 的已知文化关系；不执行浏览器检查。

**Tech Stack:** 原生 JavaScript、Node.js 静态契约脚本、Victoria 3 1.13.9 静态数据。

---

### Task 1: 先固定文化关系和无嵌套悬停的静态契约

**Files:**
- Modify: `scripts/check_tag_tooltip_contracts.mjs`
- Create: `scripts/check_culture_tooltip_relations.mjs`
- Test: `scripts/check_tag_tooltip_contracts.mjs`
- Test: `scripts/check_culture_tooltip_relations.mjs`

- [x] **Step 1: 在标签悬停契约中加入失败断言**

在读取 `definitionsSource`、`uiSource` 和 `recordStyles` 后加入以下断言：

```js
assert.match(
  definitionsSource,
  /cultureRelations:\s*{[\s\S]*heritageGroup:[\s\S]*heritage:[\s\S]*languageGroup:[\s\S]*language:[\s\S]*tradition:[\s\S]*culture:/,
  "culture relation labels are missing from tooltip definitions",
);
assert.match(uiSource, /function\s+cultureTooltipRelationSections\s*\(/, "culture relation resolver is missing");
assert.match(uiSource, /function\s+cultureTooltipRelationSection\s*\(/, "culture relation renderer is missing");
assert.match(uiSource, /cultureTraitGroupByKey\.get\(key\)/, "culture trait groups must resolve from their own index");
assert.match(uiSource, /related_countries/, "culture tooltip must show primary-culture countries");
assert.match(uiSource, /obsessions/, "culture tooltip must show obsessions");
assert.match(uiSource, /taboos/, "culture tooltip must show taboos");
assert.match(recordStyles, /\.concept-tooltip\.culture-tooltip\s*{/, "culture tooltip layout is missing");
assert.doesNotMatch(uiSource, /cultureTooltipRelationSection[\s\S]{0,1200}conceptPill\s*\(/, "culture relations must not create nested concept pills");
assert.doesNotMatch(uiSource, /cultureTooltipRelationSection[\s\S]{0,1200}title=/, "culture relations must not emit native titles");
```

- [x] **Step 2: 运行契约并确认失败原因正确**

Run: `node scripts/check_tag_tooltip_contracts.mjs`

Expected: 失败信息为 `culture relation labels are missing from tooltip definitions`，因为定义表和关系生成函数尚未实现。

- [x] **Step 3: 新增数据关系核对脚本**

创建脚本，直接解析 `site/versions/1.13.9/data-cultures.js`，并断言关系数据包含这些已知项：欧洲传承组内有“高卢”，拉美移民传承内有“阿根廷”，班图语支内有“斯瓦希里语”，西班牙语内有“西班牙”，鲁米利亚传统关联“阿尔巴尼亚”，非裔巴西文化痴迷“咖啡”，大和文化禁忌“肉类”。脚本核心如下：

```js
const raw = fs.readFileSync(dataPath, "utf8");
const data = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf(";")));
const names = (items) => new Set(items.map((item) => item.name_zh));

const european = data.cultureTraitGroups.find((item) => item.key === "heritage_group_european");
assert.ok(european);
assert.ok(names(data.cultureTraits.filter((item) => item.group_key === european.key)).has("高卢"));
assert.ok(names(data.cultures.filter((item) => item.heritage?.key === "heritage_latin_american_settler")).has("阿根廷"));
assert.ok(names(data.cultureTraits.filter((item) => item.group_key === "language_group_bantu")).has("斯瓦希里语"));
assert.ok(names(data.cultures.filter((item) => item.language?.key === "language_hispanophone")).has("西班牙"));
assert.ok(names(data.cultures.filter((item) => (item.traditions || []).some((trait) => trait.key === "tradition_rumelian"))).has("阿尔巴尼亚"));
assert.ok(names(data.cultures.find((item) => item.key === "afro_brazilian").obsessions).has("咖啡"));
assert.ok(names(data.cultures.find((item) => item.key === "japanese").taboos).has("肉类"));
console.log(JSON.stringify({ culture_tooltip_relations: "ok" }));
```

- [x] **Step 4: 运行数据关系核对脚本**

Run: `node scripts/check_culture_tooltip_relations.mjs`

Expected: `{"culture_tooltip_relations":"ok"}`。

- [x] **Step 5: 提交测试基线**

```bash
git add scripts/check_tag_tooltip_contracts.mjs scripts/check_culture_tooltip_relations.mjs
git commit -m "test: cover culture tooltip relations"
```

### Task 2: 生成文化专用的完整关系悬停内容

**Files:**
- Modify: `site/app/tag-tooltip-definitions.js`
- Modify: `site/app/ui.js`
- Modify: `site/styles/records.css`
- Modify: `site/styles.css`
- Modify: `site/index.html`
- Test: `scripts/check_tag_tooltip_contracts.mjs`

- [x] **Step 1: 在定义文件加入可编辑的关系标题**

在 `TAG_TOOLTIP_DEFAULTS` 中加入以下对象，名称由维护者直接修改：

```js
cultureRelations: {
  empty: "无",
  heritageGroup: "组内传承",
  heritage: "关联文化",
  languageGroup: "组内语言",
  language: "关联文化",
  tradition: "关联文化",
  primaryCultureCountries: "主流文化国家",
  obsessions: "痴迷",
  taboos: "禁忌",
},
```

- [x] **Step 2: 在界面层写入关系解析和纯文本分区生成器**

在 `site/app/ui.js` 的 `conceptTooltipRows` 前加入以下函数。`cultureTooltipRelationSection` 只返回转义后的文字，不能调用 `conceptPill`、`refConceptPill` 或生成 `title`。

```js
function cultureTooltipRelationSection(title, items) {
  const labels = [...(items || [])]
    .map((item) => item?.name_zh || item?.key || "")
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
  const empty = TAG_TOOLTIP_DEFAULTS.cultureRelations?.empty || "无";
  return `<section class="concept-tooltip-relation"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(labels.join("、") || empty)}</p></section>`;
}

function cultureTooltipRelationSections(kind, key) {
  const labels = TAG_TOOLTIP_DEFAULTS.cultureRelations || {};
  if (kind === "cultureTraitGroup") {
    const group = cultureTraitGroupByKey.get(key);
    const title = group?.type === "heritage" ? labels.heritageGroup : labels.languageGroup;
    const items = cultureTraits.filter((trait) => trait.group_key === key && trait.type === group?.type);
    return group ? cultureTooltipRelationSection(title, items) : "";
  }
  if (kind === "cultureTrait") {
    const trait = cultureTraitByKey.get(key);
    const title = trait?.type === "heritage" ? labels.heritage : trait?.type === "language" ? labels.language : labels.tradition;
    const items = trait?.type === "heritage"
      ? cultures.filter((culture) => culture.heritage?.key === key)
      : trait?.type === "language"
        ? cultures.filter((culture) => culture.language?.key === key)
        : cultures.filter((culture) => (culture.traditions || []).some((item) => item.key === key));
    return trait ? cultureTooltipRelationSection(title, items) : "";
  }
  if (kind === "culture") {
    const culture = byCulture.get(key);
    if (!culture) return "";
    return [
      cultureTooltipRelationSection(labels.primaryCultureCountries, culture.related_countries),
      cultureTooltipRelationSection(labels.obsessions, culture.obsessions),
      cultureTooltipRelationSection(labels.taboos, culture.taboos),
    ].join("");
  }
  return "";
}
```

调整 `conceptTooltipRows`：先取得 `relationSections`，有关系分区时不再输出通用说明行；标题、键、上下文和操作提示保持原样。调整 `showConceptTooltip` 和 `hideConceptTooltip`，根据 `cultureTooltipRelationSections(kind, key)` 切换 `culture-tooltip` 类。将 `conceptTooltipEntity` 的 `cultureTraitGroup` 分支改为 `cultureTraitGroupByKey.get(key)`。

- [x] **Step 3: 添加关系内容样式并更新缓存版本**

在 `site/styles/records.css` 增加：

```css
.concept-tooltip.culture-tooltip {
  width: min(420px, calc(100vw - 28px));
  max-width: none;
  max-height: min(70vh, 480px);
  overflow-y: auto;
}

.concept-tooltip-relation {
  display: grid;
  gap: 2px;
}

.concept-tooltip-relation h4,
.concept-tooltip-relation p {
  margin: 0;
  font-family: var(--font-ui);
  font-size: var(--text-xs);
}

.concept-tooltip-relation h4 {
  color: var(--ink);
}

.concept-tooltip-relation p {
  color: var(--muted);
  overflow-wrap: anywhere;
}
```

在 `site/styles.css` 将 `records.css` 的查询版本从 `20260722-tag-tooltips1` 更新为 `20260723-culture-tooltips1`。在 `site/index.html` 将 `styles.css`、`ui.js` 和定义文件的查询版本分别更新为 `20260723-culture-tooltips1`，并同步更新 `scripts/check_tag_tooltip_contracts.mjs` 的断言。

- [x] **Step 4: 运行新增和现有契约，确认转绿**

Run: `node scripts/check_tag_tooltip_contracts.mjs`

Expected: `{"tag_tooltip_components":"ok"}`。

Run: `node scripts/check_culture_tooltip_relations.mjs`

Expected: `{"culture_tooltip_relations":"ok"}`。

- [x] **Step 5: 提交实现**

```bash
git add site/app/tag-tooltip-definitions.js site/app/ui.js site/styles/records.css site/styles.css site/index.html scripts/check_tag_tooltip_contracts.mjs
git commit -m "feat: show culture relations in tag tooltips"
```

### Task 3: 静态回归验证和效果交接

**Files:**
- Verify: `site/app/tag-tooltip-definitions.js`
- Verify: `site/app/ui.js`
- Verify: `site/styles/records.css`
- Verify: `scripts/check_tag_tooltip_contracts.mjs`
- Verify: `scripts/check_culture_tooltip_relations.mjs`

- [x] **Step 1: 执行静态检查**

Run:

```bash
node --check site/app/tag-tooltip-definitions.js
node --check site/app/ui.js
node scripts/check_tag_tooltip_contracts.mjs
node scripts/check_culture_tooltip_relations.mjs
node scripts/check_right_panel_layout.mjs
node scripts/check_ui_ideology_contracts.mjs
node scripts/check_frontend_file_split.mjs
git diff --check
```

Expected: 每个 Node 检查以零退出码结束，两个新旧悬停检查分别输出 `{"tag_tooltip_components":"ok"}` 和 `{"culture_tooltip_relations":"ok"}`，其余现有检查继续输出 `ok`。

- [x] **Step 2: 检查提交范围**

Run: `git status --short`

Expected: 只保留本功能的已提交改动；不执行浏览器或页面悬停验证。

- [x] **Step 3: 提交验证记录**

```bash
git add docs/superpowers/specs/2026-07-23-culture-tooltip-relations-design.md docs/superpowers/plans/2026-07-23-culture-tooltip-relations.md
git commit -m "docs: plan culture tooltip relations"
```
