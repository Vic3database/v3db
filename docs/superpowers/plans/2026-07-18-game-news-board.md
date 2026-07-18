# 游戏资讯板块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页右侧展示可分类的最新游戏资讯，并在 `#/news` 提供完整的二十五条分页列表。

**Architecture:** `docs/vic3-资讯链接.md` 继续作为人工维护的来源文件，构建脚本将三张表转成 `site/news-data.js`。前端从全局数据数组筛选、按日期排序和切片：首页每类显示十条，独立资讯板块每页显示二十五条。`#/news` 是单独的站内板块，不加入顶栏主导航，也不影响既有 `#/changelog`。

**Tech Stack:** 静态 HTML、原生 JavaScript、CSS、Node.js 静态校验脚本。

---

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `docs/vic3-资讯链接.md` | 已整理的开发日志、版本更新和官方视频原始链接表。 |
| `scripts/build_news_data.mjs` | 读取三张 Markdown 表，校验记录并生成发布用资讯数据。 |
| `site/news-data.js` | 由脚本生成的 `window.VIC3_NEWS_DATA`，供浏览器直接加载。 |
| `site/index.html` | 在应用模块前加载 `news-data.js`。 |
| `site/app/runtime.js` | 保存资讯数据引用、分类和页码状态，并声明“游戏资讯”板块名称。 |
| `site/app/data.js` | 将 `news` 识别为无需游戏数据块的路由。 |
| `site/app/ui.js` | 解析 `#/news`，并在总渲染分发中调用资讯板块渲染器。 |
| `site/app/boards.js` | 提供筛选、排序、分页、首页资讯区和独立资讯板块的渲染与事件绑定。 |
| `site/styles/home.css` | 增加首页资讯区和独立资讯板块的桌面端、窄屏样式。 |
| `scripts/check_news_board.mjs` | 检查数据完整性、路由、显示条数、分页和外链安全属性。 |

### Task 1：建立可重复生成的资讯数据

**Files:**

- Create: `scripts/build_news_data.mjs`
- Create: `site/news-data.js`
- Modify: `site/index.html:253-263`
- Test: `scripts/check_news_board.mjs`

- [ ] **Step 1：写入失败的资讯数据检查**

新建 `scripts/check_news_board.mjs`，先仅检查发布文件和数据变量；在 `site/news-data.js` 尚未生成前，命令必须失败。

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "site", "news-data.js"), "utf8");
const match = source.match(/window\.VIC3_NEWS_DATA\s*=\s*(\[[\s\S]*\]);\s*$/);
assert(match, "news-data.js must define VIC3_NEWS_DATA");
const items = JSON.parse(match[1]);
assert(items.some((item) => item.category === "diary"), "news data must contain developer diaries");
assert(items.some((item) => item.category === "patch"), "news data must contain version updates");
assert(items.some((item) => item.category === "other"), "news data must contain official videos");
assert(items.every((item) => /^https:\/\//.test(item.url)), "news URLs must use HTTPS");
assert(items.every((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date)), "news items must have ISO dates");
```

- [ ] **Step 2：运行检查，确认当前状态失败**

Run:

```powershell
node scripts/check_news_board.mjs
```

Expected: `ENOENT`，因为 `site/news-data.js` 尚不存在。

- [ ] **Step 3：实现 Markdown 到静态数据的生成器**

新建 `scripts/build_news_data.mjs`。生成器从 `## 开发日志`、`## 更新日志` 和 `## 官方视频` 三个标题间读取 Markdown 表行，保留标题、链接与日期；开发日志写为 `diary`，版本更新写为 `patch`，官方视频写为 `other`。按日期降序输出，日期相同的条目按 `id` 排序，保证构建稳定。

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "docs", "vic3-资讯链接.md");
const outputPath = path.join(root, "site", "news-data.js");
const source = fs.readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, "");

const definitions = [
  { heading: "开发日志", category: "diary", label: "开发日志" },
  { heading: "更新日志", category: "patch", label: "版本更新" },
  { heading: "官方视频", category: "other", label: "官方视频" },
];

const items = definitions.flatMap((definition) => parseSection(source, definition));
assert(items.some((item) => item.id === "diary-1"), "developer diary #1 is missing");
assert(items.some((item) => item.id === "diary-184"), "developer diary #184 is missing");
assert(items.some((item) => item.id === "patch-1.13.9"), "patch 1.13.9 is missing");
assert(items.some((item) => item.id === "other-76"), "official video #76 is missing");

items.sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
fs.writeFileSync(outputPath, `window.VIC3_NEWS_DATA = ${JSON.stringify(items, null, 2)};\n`, "utf8");

function parseSection(markdown, { heading, category, label }) {
  const start = markdown.indexOf(`## ${heading}`);
  assert(start >= 0, `missing ${heading} section`);
  const next = markdown.indexOf("\n## ", start + 1);
  const rows = markdown.slice(start, next < 0 ? undefined : next).split(/\r?\n/);
  return rows.flatMap((line) => {
    const match = line.match(/^\|\s*(?:(\d+)\s*\|\s*)?\[(.+)]\((https:\/\/[^)]+)\)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|/);
    if (!match) return [];
    const [, ordinal, title, url, date] = match;
    const version = category === "patch" ? title : ordinal;
    assert(version, `${heading} row has no identifier: ${title}`);
    return [{
      id: `${category}-${version}`,
      category,
      label,
      title,
      date,
      url,
    }];
  });
}
```

- [ ] **Step 4：生成数据并加载到站点**

Run:

```powershell
node scripts/build_news_data.mjs
```

Expected: 创建 `site/news-data.js`，其中包含 184 条开发日志、77 条版本更新和 76 条官方视频。

在 `site/index.html` 的 `versions.js` 脚本后、`app/runtime.js` 前插入：

```html
<script src="news-data.js?v=20260718-news1"></script>
```

- [ ] **Step 5：运行数据检查，确认通过**

Run:

```powershell
node scripts/check_news_board.mjs
```

Expected: 数据变量可解析，三个分类和链接、日期格式检查均通过。

- [ ] **Step 6：记录可提交范围**

此任务完成后仅记录下列文件为本功能的提交范围；由于当前工作区已有与首页重叠的未提交改动，不暂存或提交任何文件。

```text
scripts/build_news_data.mjs
site/news-data.js
site/index.html
scripts/check_news_board.mjs
```

### Task 2：接入资讯状态、路由和独立板块

**Files:**

- Modify: `site/app/runtime.js:43-45,97-110,490-500`
- Modify: `site/app/data.js:76-80`
- Modify: `site/app/ui.js:669-686,856-911`
- Modify: `site/app/boards.js:1-95`
- Test: `scripts/check_news_board.mjs`

- [ ] **Step 1：扩展检查为路由和分页的失败断言**

在 `scripts/check_news_board.mjs` 中加入前端源码检查。此时应因还没有 `news` 路由和渲染器失败。

```js
import { readSiteAppSource } from "./site_frontend_sources.mjs";

const app = readSiteAppSource(root);
assert.match(app, /news: "游戏资讯"/, "news view label must exist");
assert.match(app, /parts\[0\]\s*===\s*"news"/, "hash routing must handle the news board");
assert.match(app, /function renderNewsBoard\(/, "news board renderer must exist");
assert.match(app, /const HOME_NEWS_PAGE_SIZE = 10/, "home news page size must be ten");
assert.match(app, /const NEWS_PAGE_SIZE = 25/, "news board page size must be twenty-five");
assert.match(app, /data-news-category="all"/, "home news must include the all category");
assert.match(app, /data-news-category="diary"/, "home news must include the diary category");
assert.match(app, /data-news-category="patch"/, "home news must include the patch category");
assert.match(app, /data-news-category="other"/, "home news must include the other category");
assert.match(app, /查看更多\s*→/, "home news must expose the more link");
```

- [ ] **Step 2：运行检查，确认路由断言失败**

Run:

```powershell
node scripts/check_news_board.mjs
```

Expected: `news view label must exist`。

- [ ] **Step 3：加入状态和路由**

在 `site/app/runtime.js` 的日志状态旁加入数据引用和默认状态：

```js
const newsItems = Array.isArray(window.VIC3_NEWS_DATA) ? window.VIC3_NEWS_DATA : [];

// state 对象内
newsCategory: "all",
newsPage: 1,

// viewLabels 对象内
news: "游戏资讯",
```

在 `site/app/data.js` 中让 `routeView()` 识别资讯板块而不加载游戏数据块：

```js
if (["news", "changelog"].includes(segment)) return segment;
```

在 `site/app/ui.js` 的 `applyHash()` 中，在 `changelog` 分支前加入：

```js
if (parts[0] === "news") {
  state.view = "news";
  state.detailKind = "news";
  if (!Number.isInteger(state.newsPage) || state.newsPage < 1) state.newsPage = 1;
  return;
}
```

在 `render()` 的渲染分发中加入资讯板块，并让该板块自行管理右栏：

```js
} else if (state.view === "news") {
  renderNewsBoard();
}

const boardManagesDetail = state.view === "home" || state.view === "technology" || state.view === "news";
```

- [ ] **Step 4：实现筛选、首页摘要和独立板块渲染**

在 `site/app/boards.js` 的 `renderHomeBoard()` 前加入固定分页常量与资讯辅助函数。所有标题、日期和网址都必须经过现有 `escapeHtml()`，外部链接必须带 `target="_blank" rel="noreferrer"`。

```js
const HOME_NEWS_PAGE_SIZE = 10;
const NEWS_PAGE_SIZE = 25;
const newsCategoryLabels = {
  all: "全部",
  diary: "开发日志",
  patch: "版本更新",
  other: "其他",
};

function visibleNewsItems(category = state.newsCategory) {
  return newsItems
    .filter((item) => category === "all" || item.category === category)
    .slice()
    .sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id));
}

function newsItemHtml(item, className = "news-item") {
  return `
    <a class="${className}" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
      <time datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time>
      <span class="news-item-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.label)}</small></span>
    </a>
  `;
}
```

将 `renderHomeBoard()` 中的 `home-news-placeholder` 段替换为 `renderHomeNewsHtml()`，并在该函数完成后绑定标签与“查看更多”事件：

```js
els.detail.querySelectorAll("[data-news-category]").forEach((button) => {
  button.addEventListener("click", () => {
    state.newsCategory = button.dataset.newsCategory || "all";
    state.newsPage = 1;
    renderHomeBoard();
  });
});
els.detail.querySelector("[data-news-more]")?.addEventListener("click", () => {
  state.newsPage = 1;
  location.hash = "/news";
});
```

新增 `renderNewsBoard()`：将 `visibleNewsItems()` 按 `NEWS_PAGE_SIZE` 切片，向 `els.countryList` 写入分类标签、二十五条链接和上一页、页码、下一页按钮。页码变化后调用 `renderNewsBoard()`，不修改 `location.hash`；没有上一页或下一页时按钮带 `disabled`。独立板块开始时必须调用 `renderMap([])`、清空 `els.detail`、设置 `els.countryList.className = "country-list news-board"`。

- [ ] **Step 5：运行路由和分页检查，确认通过**

Run:

```powershell
node scripts/check_news_board.mjs
node --check site/app/runtime.js
node --check site/app/data.js
node --check site/app/ui.js
node --check site/app/boards.js
```

Expected: 五条命令退出码均为 0。

- [ ] **Step 6：记录可提交范围**

本任务后续提交只应包含下面文件；当前共享工作区有未提交改动，因此此处不执行暂存或提交。

```text
site/app/runtime.js
site/app/data.js
site/app/ui.js
site/app/boards.js
scripts/check_news_board.mjs
```

### Task 3：完成样式、回归检查和浏览器核验

**Files:**

- Modify: `site/styles/home.css:500-620`
- Modify: `scripts/check_news_board.mjs`
- Test: `scripts/check_news_board.mjs`, `scripts/check_homepage_layout.mjs`, `scripts/check_ui_ideology_contracts.mjs`, `scripts/check_publish_bundle.mjs`

- [ ] **Step 1：加入缺失的样式断言**

在 `scripts/check_news_board.mjs` 中读取 `readSiteStyleSource(root)`，先要求首页面板与独立板块的选择器存在：

```js
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const styles = readSiteStyleSource(root);
assert.match(styles, /\.home-news-tabs\s*\{/, "home news tabs must have styles");
assert.match(styles, /\.home-news-more\s*\{/, "home more link must have styles");
assert.match(styles, /\.news-board\s*\{/, "news board must have styles");
assert.match(styles, /\.news-pagination\s*\{/, "news board pagination must have styles");
assert.match(styles, /body\[data-view="news"\]\s+\.map-panel/, "news view must hide the map");
assert.match(styles, /@media \(max-width: 820px\)[\s\S]*\.news-board/, "news board must adapt to narrow screens");
```

- [ ] **Step 2：运行检查，确认样式断言失败**

Run:

```powershell
node scripts/check_news_board.mjs
```

Expected: `home news tabs must have styles`。

- [ ] **Step 3：实现首页与独立板块样式**

在 `site/styles/home.css` 的 `home-news-empty` 样式位置替换占位规则，新增以下样式组：

```css
.home-news-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  margin: 12px 0 8px;
}

.home-news-tab[aria-pressed="true"] {
  border-color: rgba(200, 164, 91, 0.72);
  background: var(--accent-blue);
  color: #fff7e6;
}

.home-news-more {
  display: flex;
  justify-content: center;
  margin-top: 10px;
  padding: 8px;
  border: 1px solid rgba(200, 164, 91, 0.46);
  border-radius: 6px;
  color: var(--accent);
}

.news-board {
  display: grid;
  gap: 12px;
}

.news-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
```

补充 `body[data-view="news"]` 的规则：隐藏 `.map-panel`、`.map-toolbar` 和 `.filters`；让 `.results` 占据顶部栏以下的内容区域；隐藏通用列表头；隐藏 `.detail`。在 `@media (max-width: 820px)` 内把资讯行改为日期在上、标题在下的单列布局，四个首页标签保持不溢出，独立板块容器保持单列。

- [ ] **Step 4：运行完整静态回归检查**

Run:

```powershell
node scripts/build_news_data.mjs
node scripts/check_news_board.mjs
node scripts/check_homepage_layout.mjs
node scripts/check_ui_ideology_contracts.mjs
node scripts/check_publish_bundle.mjs
node --check site/app/runtime.js
node --check site/app/data.js
node --check site/app/ui.js
node --check site/app/boards.js
git diff --check
```

Expected: 每条命令退出码为 0；资讯检查输出包含开发日志、版本更新和官方视频的数量。

- [ ] **Step 5：浏览器核验**

启动本地站点：

```powershell
node scripts/serve_site.mjs site 8878
```

在浏览器核对以下项目：

1. 打开 `http://127.0.0.1:8878/#/home`，首页资讯区显示“全部、开发日志、版本更新、其他”四个标签，任一标签至多显示十条。
2. 点击每个标签，标题和分类标识会更新；点击一条资讯会在新标签页打开原始链接。
3. 点击“查看更多 →”后地址为 `#/news`，并保留刚才选择的类别。
4. 在 `#/news` 中确认当前页最多二十五条，分类切换后回到第一页，首页、上一页和下一页边界按钮的禁用状态正确。
5. 将浏览器宽度设为 390px，首页资讯区和独立资讯板块均没有横向滚动，标题可换行或截断，分页按钮可操作。

- [ ] **Step 6：记录可提交范围**

全部验证通过后，只能在没有与当前工作区重叠的未提交改动时暂存下列文件；否则报告已完成的本地验证和无法安全单独提交的原因。

```text
docs/vic3-资讯链接.md
scripts/build_news_data.mjs
scripts/check_news_board.mjs
site/news-data.js
site/index.html
site/app/runtime.js
site/app/data.js
site/app/ui.js
site/app/boards.js
site/styles/home.css
```

## 计划自检

设计中的首页四分类、首页十条限制、“查看更多 →”、`#/news` 路由、独立板块二十五条分页、外链打开方式、数据来源和窄屏行为分别对应任务 1 至任务 3。计划不含占位步骤；`newsCategory`、`newsPage`、`HOME_NEWS_PAGE_SIZE`、`NEWS_PAGE_SIZE`、`renderNewsBoard()` 和 `VIC3_NEWS_DATA` 在各任务中的名称一致。当前工作区已有与首页、应用模块和样式重叠的改动，因此计划明确只记录提交范围，不在执行期间覆盖、暂存或提交未知改动。
