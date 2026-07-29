# Global Tag Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为全站语义标签提供中文大悬停说明，并在大悬停触发时抑制浏览器原生小提示。

**Architecture:** 在 components.js 增加标签语义目录和共享概念属性生成器，使普通标签、引用标签、建筑图标标签与公司图标标签走同一套 data-concept 元数据。ui.js 从显式说明、实体说明和后备说明中生成大悬停，并在指针进入时清除触发元素及其子元素的 title 属性。意识形态保留原有富文本悬停布局。

**Tech Stack:** 原生浏览器 JavaScript、静态 HTML 字符串生成、Node.js assert 契约脚本。

---

## 文件结构

site/app/components.js 负责语义目录、标签元数据和标签 HTML。site/app/ui.js 负责大悬停说明与原生提示抑制。site/styles/records.css 负责说明行的文字对比度。scripts/check_tag_tooltip_contracts.mjs 只检查本功能的静态契约。

### Task 1: 用失败契约锁定标签语义目录和无原生提示的生成器

**Files:**

- Create: scripts/check_tag_tooltip_contracts.mjs
- Modify: site/app/components.js:10-220, 1374-1490, 1679-1747

- [ ] **Step 1: 写入失败契约**

~~~js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "site/app/components.js"), "utf8");

assert.match(source, /const\s+TAG_TOOLTIP_DEFINITIONS\s*=\s*new Map\(/, "semantic tag tooltip registry is missing");
assert.match(source, /country-status:start[\s\S]*开局[\s\S]*1836年开局时已存在/, "opening-country tooltip definition is missing");
assert.match(source, /country-type:殖民国家[\s\S]*殖民地/, "colonial-country tooltip definition is missing");
assert.match(source, /country-tier:公国[\s\S]*国家位阶/, "principality tooltip definition is missing");
assert.match(source, /function\s+tagTooltipMetadata\s*\(/, "tag metadata resolver is missing");
assert.match(source, /function\s+conceptDataAttributes\s*\(/, "shared concept data attribute builder is missing");

const tagPill = functionSource("tagPill");
assert.match(tagPill, /conceptPill\(\{[\s\S]*kind:\s*"tag"[\s\S]*description:/, "plain tag pills must carry a concept description");
assert.match(tagPill, /hideNativeTitle:\s*true/, "plain tag pills must suppress native titles");

const conceptPill = functionSource("conceptPill");
assert.doesNotMatch(conceptPill, /title=/, "concept pills must not emit browser-native titles");

const buildingChip = functionSource("buildingChip");
assert.match(buildingChip, /conceptDataAttributes\(\{[\s\S]*kind:\s*"building"/, "building chips must use shared concept metadata");
assert.doesNotMatch(buildingChip, /title=/, "building chips must not emit browser-native titles");

const companyDlc = functionSource("companyDlcIconPill");
assert.match(companyDlc, /tagPill\([\s\S]*company-dlc:/, "company DLC icons must use semantic tag pills");

console.log(JSON.stringify({ tag_tooltip_components: "ok" }));

function functionSource(name) {
  const start = source.indexOf("function " + name);
  if (start < 0) return "";
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  return source.slice(start);
}
~~~

- [ ] **Step 2: 运行新契约并确认失败**

Run: node scripts/check_tag_tooltip_contracts.mjs

Expected: 进程以非零状态结束，并包含 semantic tag tooltip registry is missing。

- [ ] **Step 3: 实现语义目录、数据属性和普通标签入口**

在 countryTagPills 前加入下列目录。状态标签使用精确键；其他标签依据样式类别得到明确类别，并在无专用条目时输出后备说明。

~~~js
const TAG_TOOLTIP_DEFINITIONS = new Map([
  ["country-status:start", { category: "国家状态", description: "该国家在1836年开局时已存在。" }],
  ["country-status:releasable", { category: "国家状态", description: "该国家可由现有国家通过释放附属国等机制建立。" }],
  ["country-formation:major", { category: "国家形成", description: "该国家可作为重大统一国家由满足条件的国家成立。" }],
  ["country-formation:minor", { category: "国家形成", description: "该国家可作为次要统一国家由满足条件的国家成立。" }],
  ["country-status:special", { category: "国家状态", description: "该条目使用了资料库标记的特殊国家规则。" }],
  ["country-status:dual-heritage", { category: "文化属性", description: "该国家的主流文化包含两个传承。" }],
  ["country-type:殖民国家", { category: "国家类型", description: "该国家属于殖民国家类型，使用殖民地相关的国家规则。" }],
  ["country-tier:公国", { category: "国家位阶", description: "公国是国家位阶之一，用于表示该国的初始声望层级。" }],
]);

const TAG_TOOLTIP_CLASS_CATEGORIES = [
  ["tag-type", "类型"], ["tag-tier", "位阶或类别"], ["tag-region", "区域关系"],
  ["tag-heritage", "文化传承"], ["tag-language", "语言属性"], ["tag-tradition", "文化传统"],
  ["tag-dlc", "资料片"], ["tag-good", "商品属性"], ["tag-vc", "版本来源"],
  ["tag-arable", "农业资源"], ["tag-more", "折叠项目"], ["tag-muted", "统计信息"],
];

function tagTooltipMetadata(label, className = "", sourceKey = "", semanticKey = "") {
  const firstClass = className.split(/\s+/).find(Boolean) || "tag";
  const key = semanticKey || firstClass + ":" + label;
  const definition = TAG_TOOLTIP_DEFINITIONS.get(key);
  const categoryRow = TAG_TOOLTIP_CLASS_CATEGORIES.find(([token]) => className.split(/\s+/).includes(token));
  const category = definition?.category || categoryRow?.[1] || "属性标签";
  return {
    key,
    category,
    description: definition?.description || "“" + label + "”用于标示当前条目的" + category + "。",
    sourceKey,
  };
}

function conceptDataAttributes({ kind = "", key = "", label = "", search = "", category = "", description = "" }) {
  const attribute = (name, value) => value ? name + "=\"" + escapeHtml(value) + "\"" : "";
  return [
    attribute("data-concept-kind", kind),
    attribute("data-concept-key", key),
    attribute("data-concept-label", label),
    attribute("data-concept-search", search),
    attribute("data-concept-category", category),
    attribute("data-concept-description", description),
  ].filter(Boolean).join(" ");
}
~~~

把 statusPills 的六个调用改为传递 country-status:start、country-status:releasable、country-formation:major、country-formation:minor、country-status:special 和 country-status:dual-heritage。国家类型和位阶调用传递 country-type: 后接显示名、country-tier: 后接显示名。

~~~js
function tagPill(label, className = "", title = "", semanticKey = "", html = "") {
  if (!label) return "";
  const tooltip = tagTooltipMetadata(label, className, title, semanticKey);
  return conceptPill({
    label,
    className: ["tag-pill", className].filter(Boolean).join(" "),
    title,
    hideNativeTitle: true,
    kind: "tag",
    key: tooltip.key,
    search: [label, title].filter(Boolean).join(" "),
    category: tooltip.category,
    description: tooltip.description,
    html,
  });
}
~~~

扩展 conceptPill 的参数为 category 与 description，并用 conceptDataAttributes 生成 data 属性；title 只作为概念标识符来源，不再写入 HTML。buildingChip 改为调用 conceptDataAttributes，删除 titleParts 与 title。companyDlcIconPill 改为调用 tagPill，语义键为 company-dlc: 后接资料片键，图标作为 html 参数。goodsIconHtml、buildingIconHtml 和 dlcIconHtml 生成的图片删除 title 属性。

- [ ] **Step 4: 运行标签生成器契约与既有详情布局契约**

Run: node scripts/check_tag_tooltip_contracts.mjs; node scripts/check_right_panel_layout.mjs

Expected: 两个命令均以零状态结束，并分别输出 tag_tooltip_components: "ok" 与 right_panel_layout: "ok"。

- [ ] **Step 5: 提交标签生成器和契约**

~~~bash
git add site/app/components.js scripts/check_tag_tooltip_contracts.mjs
git commit -m "feat: add semantic metadata to tag pills"
~~~

### Task 2: 为通用大悬停添加说明并在延迟前抑制遗留提示

**Files:**

- Modify: scripts/check_tag_tooltip_contracts.mjs
- Modify: site/app/ui.js:357-560
- Modify: site/styles/records.css:373-407

- [ ] **Step 1: 追加大悬停失败契约**

~~~js
const uiSource = fs.readFileSync(path.join(root, "site/app/ui.js"), "utf8");
const recordStyles = fs.readFileSync(path.join(root, "site/styles/records.css"), "utf8");

assert.match(uiSource, /function\s+conceptTooltipDescription\s*\(/, "concept tooltip description resolver is missing");
assert.match(uiSource, /function\s+suppressNativeTooltip\s*\(/, "native tooltip suppression helper is missing");
assert.match(uiSource, /scheduleConceptTooltip[\s\S]*suppressNativeTooltip\(target\)/, "native tooltip suppression must run before the hover delay");
assert.match(uiSource, /data\.conceptDescription/, "concept tooltip must read explicit tag descriptions");
assert.match(uiSource, /concept-tooltip-description/, "concept tooltip must render a readable description row");
assert.match(recordStyles, /\.concept-tooltip-description\s*\{[\s\S]*color:\s*var\(--ink\)/, "tooltip description style is missing");
~~~

- [ ] **Step 2: 运行扩展契约并确认失败**

Run: node scripts/check_tag_tooltip_contracts.mjs

Expected: 进程以非零状态结束，并包含 concept tooltip description resolver is missing。

- [ ] **Step 3: 实现说明解析、提示抑制和说明样式**

在 scheduleConceptTooltip 的折叠面板检查之后、创建延迟定时器之前调用 suppressNativeTooltip(target)。

~~~js
function suppressNativeTooltip(target) {
  target.removeAttribute("title");
  target.querySelectorAll("[title]").forEach((node) => node.removeAttribute("title"));
}

function conceptTooltipDescription(target, kind, key, label) {
  const explicit = target.dataset.conceptDescription || "";
  if (explicit) return explicit;
  const entity = conceptTooltipEntity(kind, key);
  const description = String(entity?.desc_zh || entity?.modifier_summary_zh || "").replace(/\s+/g, " ").trim();
  if (description) return description;
  const category = target.dataset.conceptCategory || conceptKindLabel(kind);
  return "“" + (label || key) + "”属于" + category + "。";
}

function conceptTooltipEntity(kind, key) {
  if (kind === "country") return byTag.get(key);
  if (kind === "culture") return byCulture.get(key);
  if (kind === "stateRegion") return byStateRegion.get(key);
  if (kind === "strategicRegion") return byStrategicRegion.get(key);
  if (kind === "geographicRegion") return byGeographicRegion.get(key);
  if (kind === "company") return byCompany.get(key);
  if (kind === "ideology") return ideologyByKey.get(key);
  if (kind === "law") return lawByKey.get(key);
  if (kind === "interestGroup") return byInterestGroup.get(key);
  if (kind === "interestGroupTrait") return interestGroupTraitByKey.get(key);
  if (kind === "cultureTrait" || kind === "cultureTraitGroup") return cultureTraitByKey.get(key);
  return null;
}
~~~

把 conceptTooltipRows 的类别值改为 target.dataset.conceptCategory || conceptKindLabel(kind)，并在上下文行之后插入 class 为 concept-tooltip-description 的 span。意识形态仍由 ideologyTooltipRows 渲染。向 site/styles/records.css 添加下列规则。

~~~css
.concept-tooltip .concept-tooltip-description {
  color: var(--ink);
}
~~~

- [ ] **Step 4: 运行语法检查、功能契约和既有界面契约**

Run: node --check site/app/components.js; node --check site/app/ui.js; node scripts/check_tag_tooltip_contracts.mjs; node scripts/check_right_panel_layout.mjs; node scripts/check_ui_ideology_contracts.mjs

Expected: 五个命令均以零状态结束；两个既有界面契约分别输出 right_panel_layout: "ok" 和 ui_ideology_contracts: "ok"。

- [ ] **Step 5: 提交大悬停说明与样式**

~~~bash
git add site/app/ui.js site/styles/records.css scripts/check_tag_tooltip_contracts.mjs
git commit -m "feat: describe tags in concept tooltips"
~~~

### Task 3: 执行全范围回归和浏览器样本检查

**Files:**

- Modify: scripts/check_tag_tooltip_contracts.mjs
- Modify: site/index.html:271-280

- [ ] **Step 1: 用契约覆盖各板块的标签生成路径**

~~~js
for (const functionName of [
  "countryTagPills", "strategicRegionTagPills", "geographicRegionTagPills",
  "companyTagPills", "companyPrestigeGoodPill", "traitPill", "ideologyPill",
]) {
  assert.match(source, new RegExp("function\\s+" + functionName + "\\s*\\("), functionName + " tag generator is missing");
}
assert.match(source, /function\s+refConceptPill\s*\([\s\S]*conceptPill\(/, "reference tags must stay on the concept-pill path");
assert.match(source, /function\s+buildingChip\s*\([\s\S]*data-concept-key/, "state-region building tags must expose concept metadata");
~~~

- [ ] **Step 2: 运行扩展契约**

Run: node scripts/check_tag_tooltip_contracts.mjs

Expected: 输出 {"tag_tooltip_components":"ok"}，不出现板块生成器缺失错误。

- [ ] **Step 3: 更新缓存参数**

在 site/index.html 中把 app/ui.js、app/components.js 和 styles.css 的查询参数统一改为 v=20260722-tag-tooltips1。脚本加载顺序保持不变：ui.js 在 components.js 前，bootstrap.js 在两者之后。

- [ ] **Step 4: 运行最终静态检查**

Run: node scripts/check_tag_tooltip_contracts.mjs; node scripts/check_right_panel_layout.mjs; node scripts/check_ui_ideology_contracts.mjs; node scripts/check_frontend_file_split.mjs

Expected: 四项检查均以零状态结束，模块文件清单完整。

- [ ] **Step 5: 在本地浏览器按固定样本核验单一提示层**

Run: python -m http.server 4173 --directory site

打开 http://localhost:4173/#/country，悬停“开局”“殖民国家”“公国”和传承组标签。每个标签只显示 #conceptTooltip，没有浏览器原生小提示。继续检查文化页的传统标签、州地区页的建筑图标标签、公司页的资料片或商品标签、意识形态页的意识形态标签。每个样本均有可读中文说明，意识形态仍显示原有富文本卡片。

- [ ] **Step 6: 提交缓存参数与最终契约范围**

~~~bash
git add site/index.html scripts/check_tag_tooltip_contracts.mjs
git commit -m "test: cover global tag tooltip behavior"
~~~
