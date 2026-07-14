# 首页独立分类卡片实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 将首页六个导航分类改为独立卡片，同时保留各入口的内容、图标与跳转行为。

**架构：** `renderHomeBoard()` 以分类定义数组生成六个卡片，每张卡片只处理自身标题和入口。`site/styles.css` 以六列网格确定卡片宽度与响应式收缩规则。`scripts/check_homepage_layout.mjs` 对渲染结构和样式规则实施静态回归检查。

**技术栈：** 原生 JavaScript、HTML 模板字符串、CSS Grid、Node.js 静态检查脚本。

---

### 任务 1：更新首页结构的回归检查

**文件：**
- 修改：`scripts/check_homepage_layout.mjs`

- [ ] **步骤 1：写入独立分类卡片的失败断言**

在现有 `categoryRows` 断言附近替换为以下检查，使当前实现因仍使用成对行容器而失败：

```js
expect(homeFunction.includes("const categories = ["), "homepage should define independent category cards");
expect(!homeFunction.includes("const categoryRows ="), "homepage should not pair categories into shared row containers");
expect((homeFunction.match(/class=\"home-category-card/g) || []).length === 2, "homepage should render one category-card template");
expect(/\.home-category-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(6,/.test(stylesSource), "homepage category cards should use a six-column grid");
expect(/\.home-category-card\s*\{[\s\S]*grid-column:\s*span\s*3/.test(stylesSource), "three-entry categories should span three columns");
expect(/\.home-category-card\.home-category-economy\s*\{[\s\S]*grid-column:\s*span\s*4/.test(stylesSource), "economy should span four columns");
expect(/\.home-category-card\.home-category-military\s*\{[\s\S]*grid-column:\s*span\s*2/.test(stylesSource), "military should span two columns");
expect(/\.home-category-card\s*\{[\s\S]*border:\s*1px solid rgba\(200, 164, 91, 0\.2\)/.test(stylesSource), "category cards should use the standard subdued gold border");
```

- [ ] **步骤 2：运行检查并确认失败原因正确**

运行：`node scripts/check_homepage_layout.mjs`

预期：退出码为 1，错误包含 `homepage should define independent category cards` 和 `homepage should not pair categories into shared row containers`。

### 任务 2：改为独立分类卡片结构

**文件：**
- 修改：`site/app.js:1952-2020` 的 `renderHomeBoard()`

- [ ] **步骤 1：将成对分类定义改为单个分类定义**

删除：

```js
const categoryRows = [["外交", "内政"], ["经济", "军事"], ["社会", "其他"]];
```

改为：

```js
const categories = [
  { name: "外交", className: "home-category-diplomacy" },
  { name: "内政", className: "home-category-domestic" },
  { name: "经济", className: "home-category-economy" },
  { name: "军事", className: "home-category-military" },
  { name: "社会", className: "home-category-society" },
  { name: "其他", className: "home-category-other" },
];
```

- [ ] **步骤 2：以单独卡片模板渲染每个分类**

将 `categoryRows.map(...)` 的模板替换为：

```js
${categories.map(({ name, className }) => {
  const categoryEntries = entries.filter((entry) => entry.category === name);
  return `
    <section class="home-category-card ${className}" aria-label="${escapeHtml(name)}">
      <div class="home-category-heading"><h2>${escapeHtml(name)}</h2><span>${escapeHtml(String(categoryEntries.length))} 项</span></div>
      <div class="home-entry-grid">
        ${categoryEntries.map((entry) => entry.view ? `
          <button class="home-entry" type="button" data-home-view="${escapeHtml(entry.view)}">
            <img class="home-entry-icon" src="${escapeHtml(entry.icon)}" alt="" aria-hidden="true">
            <span class="home-entry-copy"><strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(entry.text)}</small></span>
          </button>
        ` : `
          <article class="home-entry home-entry-pending" aria-label="${escapeHtml(entry.label)}，筹备中">
            <img class="home-entry-icon" src="${escapeHtml(entry.icon)}" alt="" aria-hidden="true">
            <span class="home-entry-copy"><strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(entry.text)}</small></span>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}).join("")}
```

- [ ] **步骤 3：运行结构检查**

运行：`node scripts/check_homepage_layout.mjs`

预期：仍失败，失败项仅为尚未调整的样式规则。

### 任务 3：实现六列卡片布局和响应式规则

**文件：**
- 修改：`site/styles.css:4521-4584`
- 修改：`site/styles.css:4819-4875`

- [ ] **步骤 1：替换旧的共用行规则**

删除 `.home-category-row` 及其标题跨列规则，使用：

```css
.home-category-list {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 14px 10px;
}

.home-category-card {
  grid-column: span 3;
  padding: 12px;
  border: 1px solid rgba(200, 164, 91, 0.2);
  border-radius: 8px;
  background: rgba(31, 33, 31, 0.46);
}

.home-category-card.home-category-economy { grid-column: span 4; }
.home-category-card.home-category-military { grid-column: span 2; }

.home-category-card .home-entry-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.home-category-card.home-category-economy .home-entry-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.home-category-card.home-category-military .home-entry-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
```

- [ ] **步骤 2：改写窄屏规则**

在 `@media (max-width: 820px)` 内删除 `.home-category-row` 相关选择器，并添加：

```css
.home-category-list { grid-template-columns: minmax(0, 1fr); }
.home-category-card,
.home-category-card.home-category-economy,
.home-category-card.home-category-military { grid-column: auto; }
.home-category-card .home-entry-grid,
.home-category-card.home-category-economy .home-entry-grid,
.home-category-card.home-category-military .home-entry-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
```

在 `@media (max-width: 520px)` 内添加：

```css
.home-category-card .home-entry-grid,
.home-category-card.home-category-economy .home-entry-grid,
.home-category-card.home-category-military .home-entry-grid { grid-template-columns: minmax(0, 1fr); }
```

- [ ] **步骤 3：运行静态检查并确认通过**

运行：`node scripts/check_homepage_layout.mjs`

预期：退出码为 0，并输出 `"homepage_layout": "ok"`、`"entries": 18`、`"icons": 18`。

### 任务 4：验证渲染结果

**文件：**
- 验证：`site/index.html`
- 验证：`site/app.js`
- 验证：`site/styles.css`

- [ ] **步骤 1：执行语法和空白检查**

运行：`node --check site/app.js; git diff --check`

预期：两个命令均退出码为 0。

- [ ] **步骤 2：在本地首页检查桌面布局**

启动静态服务后打开 `#/home`，确认有六张彼此独立的分类卡片；外交、内政、社会、其他分别占三列，经济和军事同排且分别占四列、两列；卡片边框为低饱和金色。

- [ ] **步骤 3：检查窄屏布局**

将视口缩至 820px 与 520px 以下，确认分类卡片单列排列，内部入口先为两列再为一列，并且没有横向溢出。

- [ ] **步骤 4：提交改动**

运行：`git add site/app.js site/styles.css scripts/check_homepage_layout.mjs && git commit -m "feat: separate homepage category cards"`
