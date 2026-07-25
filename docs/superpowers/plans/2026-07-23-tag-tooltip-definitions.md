# 标签悬停定义文件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将可编辑的标签悬停分类和说明移入独立 JavaScript 定义文件，同时保持全部标签的大悬停与原生小悬停抑制行为。

**Architecture:** `site/app/tag-tooltip-definitions.js` 只声明一个普通对象常量，组件按现有优先级读取对象属性，将命中的分类和说明传递给既有概念元数据。HTML 在 `components.js` 前加载此文件；悬停界面、实体说明回退、搜索和样式不变。

**Tech Stack:** 原生 JavaScript、静态 HTML 脚本加载、Node.js 契约检查、Playwright 浏览器检查。

---

### Task 1: 为独立定义文件建立失败契约

**Files:**
- Modify: `scripts/check_tag_tooltip_contracts.mjs`
- Test: `scripts/check_tag_tooltip_contracts.mjs`

- [ ] **Step 1: 将定义文件契约写入静态检查**

  把检查脚本开头的 `components.js` 读取保留，并新增定义文件与页面入口的读取：

  ```js
  const definitionsSource = fs.readFileSync(
    path.join(process.cwd(), "site/app/tag-tooltip-definitions.js"),
    "utf8",
  );
  const indexSource = fs.readFileSync(path.join(process.cwd(), "site/index.html"), "utf8");
  ```

  删除现有针对 `components.js` 内联 `new Map` 的断言，改为以下断言：

  ```js
  assert.match(
    definitionsSource,
    /const TAG_TOOLTIP_DEFINITIONS\s*=\s*{/, 
    "TAG_TOOLTIP_DEFINITIONS object declaration is missing",
  );
  assert.doesNotMatch(
    source,
    /const TAG_TOOLTIP_DEFINITIONS\s*=/,
    "components.js must not own editable tooltip definitions",
  );

  for (const semanticKey of [
    "country-status:start",
    "country-status:releasable",
    "country-formation:major",
    "country-formation:minor",
    "country-status:special",
    "country-status:dual-heritage",
    "country-type:殖民国家",
    "country-tier:公国",
    "tag-type",
    "tag-tier",
    "tag-region",
    "tag-heritage",
    "tag-language",
    "tag-tradition",
    "tag-dlc",
    "tag-good",
    "tag-vc",
    "tag-arable",
    "tag-more",
    "tag-muted",
  ]) {
    assert.match(
      definitionsSource,
      new RegExp(`"${semanticKey}"\\s*:`),
      `TAG_TOOLTIP_DEFINITIONS is missing ${semanticKey}`,
    );
  }

  assert.match(definitionsSource, /country-status:start[\s\S]{0,500}1836年开局时已存在/);
  assert.match(definitionsSource, /country-type:殖民国家[\s\S]{0,500}殖民地类型/);
  assert.match(definitionsSource, /country-tier:公国[\s\S]{0,500}国家位阶/);
  assert.match(source, /TAG_TOOLTIP_DEFINITIONS\[definitionKey\]/);

  const definitionsScriptOffset = indexSource.indexOf("app/tag-tooltip-definitions.js");
  const componentsScriptOffset = indexSource.indexOf("app/components.js");
  assert.ok(definitionsScriptOffset >= 0, "tooltip definitions script is missing");
  assert.ok(componentsScriptOffset > definitionsScriptOffset, "tooltip definitions must load before components");
  ```

  保留文件末尾既有 `indexSource` 声明时，将其删除，避免重复定义。将缓存版本断言改为：

  ```js
  assert.match(indexSource, /app\/tag-tooltip-definitions\.js\?v=20260723-tag-tooltip-definitions1/);
  assert.match(indexSource, /app\/components\.js\?v=20260723-tag-tooltip-definitions1/);
  ```

- [ ] **Step 2: 运行检查，确认当前实现失败**

  Run: `node scripts/check_tag_tooltip_contracts.mjs`

  Expected: FAIL，错误指出 `site/app/tag-tooltip-definitions.js` 不存在或定义文件契约缺失。

- [ ] **Step 3: 提交失败测试**

  ```powershell
  git add scripts/check_tag_tooltip_contracts.mjs
  git commit -m "test: require external tag tooltip definitions"
  ```

### Task 2: 移出可编辑定义并保持元数据接口

**Files:**
- Create: `site/app/tag-tooltip-definitions.js`
- Modify: `site/app/components.js:10-73,176-185`
- Modify: `site/index.html:273-280`
- Test: `scripts/check_tag_tooltip_contracts.mjs`

- [ ] **Step 1: 创建仅含可编辑数据的定义文件**

  新建 `site/app/tag-tooltip-definitions.js`，写入以下完整内容：

  ```js
  // 标签悬停的可编辑分类与说明。键应使用标签生成器传入的稳定语义键或样式类别。
  const TAG_TOOLTIP_DEFINITIONS = {
    "country-status:start": { category: "国家状态", description: "该国家在1836年开局时已存在。" },
    "country-status:releasable": { category: "国家状态", description: "该国家可由现有国家通过释放附属国等机制建立。" },
    "country-formation:major": { category: "国家统一", description: "该国家可作为重大统一国家建立。" },
    "country-formation:minor": { category: "国家统一", description: "该国家可作为次要统一国家建立。" },
    "country-status:special": { category: "国家状态", description: "该国家具有特殊的建立或显示规则。" },
    "country-status:dual-heritage": { category: "国家状态", description: "该国家同时拥有两种文化传承。" },
    "country-type:殖民国家": { category: "国家类型", description: "该国家属于殖民地类型。" },
    "country-tier:公国": { category: "国家位阶", description: "该国家的初始国家位阶为公国。" },
    "country-type": { category: "国家类型" },
    "country-tier": { category: "国家位阶" },
    "company-dlc": { category: "资料片" },
    "tag-type": { category: "类型" },
    "tag-tier": { category: "位阶" },
    "tag-region": { category: "地区" },
    "tag-heritage": { category: "文化传承" },
    "tag-language": { category: "语言" },
    "tag-tradition": { category: "文化传统" },
    "tag-dlc": { category: "资料片" },
    "tag-good": { category: "商品" },
    "tag-vc": { category: "版本来源" },
    "tag-arable": { category: "可耕地资源" },
    "tag-more": { category: "数量说明" },
    "tag-muted": { category: "补充信息" },
    "tag-mapi": { category: "市场接入价格影响" },
    "tag-effect": { category: "效果" },
    "tag-release": { category: "国家状态" },
    "tag-dual": { category: "国家状态" },
    "tag-special": { category: "特殊属性" },
    "tag-ig-changed": { category: "名称变体" },
    "good": { category: "国家状态" },
    "warn": { category: "国家状态" },
    "special": { category: "国家状态" },
  };
  ```

- [ ] **Step 2: 将组件改为读取定义对象**

  从 `site/app/components.js` 删除当前 `const TAG_TOOLTIP_DEFINITIONS = new Map([...]);` 的完整块。在 `tagTooltipMetadata` 中只改动定义读取两行：

  ```js
  const definitionKey = [semanticKey, semanticPrefix, sourceKey, ...classKeys]
    .find((key) => key && TAG_TOOLTIP_DEFINITIONS[key]);
  const definition = TAG_TOOLTIP_DEFINITIONS[definitionKey] || {};
  ```

  其余 `key`、`category`、`description` 和通用兜底文本保持原样，保证 `tagPill`、`conceptPill` 与 `conceptTag` 仍产出相同的 `data-concept-*` 属性。

- [ ] **Step 3: 在组件前加载定义文件并更新缓存版本**

  将 `site/index.html` 末尾脚本段替换为：

  ```html
  <script src="app/presentation.js?v=20260718-company-location2"></script>
  <script src="app/map.js?v=20260718-company-location2"></script>
  <script src="app/tag-tooltip-definitions.js?v=20260723-tag-tooltip-definitions1"></script>
  <script src="app/components.js?v=20260723-tag-tooltip-definitions1"></script>
  <script src="app/bootstrap.js?v=20260718-file-split1"></script>
  ```

- [ ] **Step 4: 运行静态检查，确认定义拆分完成**

  Run: `node scripts/check_tag_tooltip_contracts.mjs`

  Expected: `{"tag_tooltip_components":"ok"}`。

- [ ] **Step 5: 提交实现**

  ```powershell
  git add site/app/tag-tooltip-definitions.js site/app/components.js site/index.html scripts/check_tag_tooltip_contracts.mjs
  git commit -m "feat: externalize tag tooltip definitions"
  ```

### Task 3: 回归检查和浏览器验证

**Files:**
- Modify: `scripts/check_right_panel_layout.mjs`（仅在其缓存版本断言仍引用旧版 `components.js` 时）
- Test: `scripts/check_tag_tooltip_contracts.mjs`, `scripts/check_right_panel_layout.mjs`, `scripts/check_ui_ideology_contracts.mjs`, `scripts/check_frontend_file_split.mjs`

- [ ] **Step 1: 写入右侧面板检查所需的新缓存版本**

  先运行下列命令：

  ```powershell
  node scripts/check_right_panel_layout.mjs
  ```

  若输出仅因 `app/components.js` 的缓存查询串不匹配而失败，在 `scripts/check_right_panel_layout.mjs` 将该预期值改为 `app/components.js?v=20260723-tag-tooltip-definitions1`；不要改动任何版面断言。若检查通过，则此文件不修改。

- [ ] **Step 2: 运行全部静态回归检查**

  Run:

  ```powershell
  node --check site/app/tag-tooltip-definitions.js
  node --check site/app/components.js
  node scripts/check_tag_tooltip_contracts.mjs
  node scripts/check_right_panel_layout.mjs
  node scripts/check_ui_ideology_contracts.mjs
  node scripts/check_frontend_file_split.mjs
  git diff --check
  ```

  Expected: 所有脚本返回 0；标签契约输出 `{"tag_tooltip_components":"ok"}`；`git diff --check` 没有输出。

- [ ] **Step 3: 在浏览器验证定义文件的实际呈现**

  通过本地静态服务打开 `site/index.html`，进入国家页面。分别悬停“开局”“殖民国家”“公国”标签，确认悬停框的分类与说明来自定义文件，且目标元素和其内部元素都没有 `title`。再进入文化、公司和意识形态页面，各悬停一个未专门定义的标签，确认实体说明或通用说明仍可见。

- [ ] **Step 4: 提交检查脚本的条件性缓存调整**

  仅在 Step 1 修改了 `scripts/check_right_panel_layout.mjs` 时执行：

  ```powershell
  git add scripts/check_right_panel_layout.mjs
  git commit -m "test: update tag tooltip cache expectation"
  ```

