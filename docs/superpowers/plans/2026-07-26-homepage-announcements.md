# 首页公告维护实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让维护者编辑仓库根目录的 Markdown 公告文件，并在发布站点前生成、校验和显示首页公告数据。

**Architecture:** `announcements.md` 是唯一人工维护源；`scripts/lib/announcements.mjs` 负责解析和序列化；构建脚本生成 `site/announcement-data.js`。首页在应用脚本前加载生成数据，公告栏从运行时数组渲染。发布检查重新生成期望内容并与发布文件逐字比较，阻止旧公告进入服务器目录。

**Tech Stack:** Node.js 内置模块、原生 JavaScript、Markdown、HTML、CSS。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `announcements.md` | 人工维护的公告源，规定日期、标题和正文。 |
| `scripts/lib/announcements.mjs` | 纯解析与序列化函数，供检查、构建和发布检查共用。 |
| `scripts/build_announcements_data.mjs` | 从源文件生成浏览器数据文件的命令行入口。 |
| `scripts/check_announcements.mjs` | 解析、构建、前端接线与发布文件一致性的自动检查。 |
| `site/announcement-data.js` | 发布目录中的生成结果，定义 `window.VICDATA_ANNOUNCEMENTS`。 |
| `site/index.html` | 在应用脚本前加载公告数据。 |
| `site/app/runtime.js` | 提供公告运行时数组。 |
| `site/app/boards.js` | 将公告数组渲染到首页侧栏。 |
| `site/styles/home.css` | 限制公告栏高度并提供滚动与空状态样式。 |
| `scripts/check_publish_bundle.mjs` | 将公告生成文件纳入发布包，并检查其与源文件一致。 |
| `README.md` | 说明公告格式、生成命令和发布前检查。 |

### Task 1：建立公告解析器与失败检查

**Files:**
- Create: `scripts/check_announcements.mjs`
- Create: `scripts/lib/announcements.mjs`

- [ ] **Step 1：写入解析器的失败检查**

在 `scripts/check_announcements.mjs` 写入以下完整检查，先引用尚不存在的模块：

```js
import assert from "node:assert/strict";
import { parseAnnouncements, serializeAnnouncements } from "./lib/announcements.mjs";

const validSource = `# 站内公告

## 2026-07-20｜较早公告

第一段正文。

第二段正文。

## 2026-07-26｜较新公告

最新正文。`;

assert.deepEqual(parseAnnouncements(validSource), [
  { date: "2026-07-26", title: "较新公告", body: "最新正文。" },
  { date: "2026-07-20", title: "较早公告", body: "第一段正文。\n\n第二段正文。" },
]);
assert.throws(() => parseAnnouncements("# 站内公告\n\n## 标题\n\n正文"), /日期和标题/);
assert.throws(() => parseAnnouncements("# 站内公告\n\n## 2026-07-26｜标题"), /正文/);
assert.equal(
  serializeAnnouncements([{ date: "2026-07-26", title: "标题", body: "正文" }]),
  'window.VICDATA_ANNOUNCEMENTS = [\n  {\n    "date": "2026-07-26",\n    "title": "标题",\n    "body": "正文"\n  }\n];\n',
);

console.log("announcement parser checks passed");
```

- [ ] **Step 2：运行检查并确认其因模块缺失失败**

运行：`node scripts/check_announcements.mjs`

预期：命令以非零状态退出，并报告无法找到 `scripts/lib/announcements.mjs`。

- [ ] **Step 3：实现最小解析与序列化模块**

在 `scripts/lib/announcements.mjs` 写入以下代码：

```js
const headingPattern = /^##\s+(\d{4}-\d{2}-\d{2})｜(.+?)\s*$/u;

export function parseAnnouncements(source) {
  const lines = String(source).replaceAll("\r\n", "\n").split("\n");
  if (lines[0]?.trim() !== "# 站内公告") {
    throw new Error("公告文件第一行必须是 # 站内公告");
  }

  const items = [];
  let current = null;
  const finishCurrent = () => {
    if (!current) return;
    const body = current.lines.join("\n").trim();
    if (!body) throw new Error(`公告第 ${current.line} 行缺少正文`);
    items.push({ date: current.date, title: current.title, body });
  };

  lines.forEach((line, index) => {
    if (!line.startsWith("## ")) {
      if (current) current.lines.push(line);
      return;
    }
    finishCurrent();
    const match = line.match(headingPattern);
    if (!match) throw new Error(`公告第 ${index + 1} 行必须使用 YYYY-MM-DD｜标题，且同时包含日期和标题`);
    current = { date: match[1], title: match[2].trim(), line: index + 1, lines: [] };
  });
  finishCurrent();

  if (!items.length) throw new Error("公告文件至少需要一条公告");
  return items.sort((left, right) => right.date.localeCompare(left.date));
}

export function serializeAnnouncements(items) {
  return `window.VICDATA_ANNOUNCEMENTS = ${JSON.stringify(items, null, 2)};\n`;
}
```

- [ ] **Step 4：运行检查并确认解析器通过**

运行：`node scripts/check_announcements.mjs`

预期：输出 `announcement parser checks passed`，退出状态为 0。

- [ ] **Step 5：提交解析器与检查**

运行：`git add scripts/lib/announcements.mjs scripts/check_announcements.mjs && git commit -m "feat: parse site announcements"`

预期：只提交本任务新增的两个文件。

### Task 2：生成公告发布文件并提供可编辑源文件

**Files:**
- Modify: `scripts/check_announcements.mjs`
- Create: `scripts/build_announcements_data.mjs`
- Create: `announcements.md`
- Create: `site/announcement-data.js`

- [ ] **Step 1：为命令行生成器写入失败检查**

在 `scripts/check_announcements.mjs` 顶部的导入区加入以下五项导入，并在现有解析器断言后添加余下代码：

```js
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const checkDir = path.dirname(fileURLToPath(import.meta.url));
const builderFile = path.join(checkDir, "build_announcements_data.mjs");
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vicdata-announcements-"));
fs.mkdirSync(path.join(fixtureRoot, "site"));
fs.writeFileSync(path.join(fixtureRoot, "announcements.md"), validSource, "utf8");
execFileSync(process.execPath, [builderFile, fixtureRoot], { stdio: "pipe" });
assert.equal(
  fs.readFileSync(path.join(fixtureRoot, "site", "announcement-data.js"), "utf8"),
  serializeAnnouncements(parseAnnouncements(validSource)),
);
fs.rmSync(fixtureRoot, { recursive: true, force: true });
```

- [ ] **Step 2：运行检查并确认其因生成器缺失失败**

运行：`node scripts/check_announcements.mjs`

预期：命令以非零状态退出，并报告找不到 `scripts/build_announcements_data.mjs`。

- [ ] **Step 3：实现生成器并创建初始公告文件**

在 `scripts/build_announcements_data.mjs` 写入：

```js
import fs from "node:fs";
import path from "node:path";
import { parseAnnouncements, serializeAnnouncements } from "./lib/announcements.mjs";

const root = path.resolve(process.argv[2] || process.cwd());
const sourceFile = path.join(root, "announcements.md");
const outputFile = path.join(root, "site", "announcement-data.js");
const items = parseAnnouncements(fs.readFileSync(sourceFile, "utf8"));

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, serializeAnnouncements(items), "utf8");
console.log(JSON.stringify({ announcements: items.length, output: path.relative(root, outputFile) }));
```

在 `announcements.md` 写入：

```markdown
# 站内公告

## 2026-07-13｜主页资料入口正在调整

已建成的板块可以直接进入，后续板块会在资料准备完成后开放。

## 2026-07-13｜当前数据版本：Victoria 3 1.13.9

页面中的资料、筛选条件和地图内容以当前选择的版本为准。
```

- [ ] **Step 4：生成发布数据并确认检查通过**

运行：`node scripts/build_announcements_data.mjs; node scripts/check_announcements.mjs`

预期：生成 `site/announcement-data.js`，随后输出 `announcement parser checks passed`，两个命令均以状态 0 结束。

- [ ] **Step 5：提交源文件与生成器**

运行：`git add announcements.md scripts/build_announcements_data.mjs scripts/check_announcements.mjs site/announcement-data.js && git commit -m "feat: generate site announcement data"`

预期：公告源、生成器、生成结果和扩展后的检查一同提交。

### Task 3：将首页公告栏接入生成数据

**Files:**
- Modify: `scripts/check_announcements.mjs`
- Modify: `site/index.html:268-281`
- Modify: `site/app/runtime.js:31-33`
- Modify: `site/app/boards.js:106-202`
- Modify: `site/styles/home.css:533-570`

- [ ] **Step 1：为前端接线写入失败检查**

在 `scripts/check_announcements.mjs` 添加以下函数并在文件末尾调用：

```js
function checkFrontendContract(root) {
  const index = fs.readFileSync(path.join(root, "site", "index.html"), "utf8");
  const runtime = fs.readFileSync(path.join(root, "site", "app", "runtime.js"), "utf8");
  const boards = fs.readFileSync(path.join(root, "site", "app", "boards.js"), "utf8");
  const homeStyles = fs.readFileSync(path.join(root, "site", "styles", "home.css"), "utf8");
  assert.match(index, /<script src="announcement-data\.js\?v=20260726-announcements1"><\/script>/);
  assert.match(runtime, /const announcementItems = Array\.isArray\(window\.VICDATA_ANNOUNCEMENTS\)/);
  assert.match(boards, /function announcementItemHtml\(item\)/);
  assert.match(boards, /announcementItems\.map\(announcementItemHtml\)/);
  assert.match(boards, /暂无公告/);
  assert.match(homeStyles, /\.home-announcement-list\s*\{/);
  assert.match(homeStyles, /max-height:\s*min\(48vh, 560px\)/);
}

checkFrontendContract(process.cwd());
```

- [ ] **Step 2：运行检查并确认其因首页未接线失败**

运行：`node scripts/check_announcements.mjs`

预期：命令以非零状态退出，断言缺少 `announcement-data.js` 的页面加载标签。

- [ ] **Step 3：以最小改动接入首页**

在 `site/index.html` 的 `news-data.js` 前加入：

```html
<script src="announcement-data.js?v=20260726-announcements1"></script>
```

在 `site/app/runtime.js` 的 `newsItems` 前加入：

```js
const announcementItems = Array.isArray(window.VICDATA_ANNOUNCEMENTS) ? window.VICDATA_ANNOUNCEMENTS : [];
```

在 `site/app/boards.js` 的 `renderHomeBoard()` 前加入：

```js
function announcementItemHtml(item) {
  const body = escapeHtml(item.body).replaceAll("\n", "<br>");
  return `
    <article class="home-announcement-item">
      <time datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time>
      <strong>${escapeHtml(item.title)}</strong>
      <p>${body}</p>
    </article>
  `;
}
```

删除 `renderHomeBoard()` 中 `homeUpdatedAt` 的计算和两个写死的 `home-announcement-item`。在原公告栏位置写入：

```js
<section class="home-side-panel home-announcement">
  <div class="home-side-heading"><h2>公告</h2><span>站内</span></div>
  ${announcementItems.length
    ? `<div class="home-announcement-list">${announcementItems.map(announcementItemHtml).join("")}</div>`
    : `<p class="home-announcement-empty">暂无公告。</p>`}
</section>
```

在 `site/styles/home.css` 现有公告规则后加入：

```css
.home-announcement {
  display: flex;
  flex-direction: column;
}

.home-announcement-list {
  max-height: min(48vh, 560px);
  overflow-y: auto;
  padding-right: 6px;
  scrollbar-gutter: stable;
}

.home-announcement-empty {
  margin: 14px 0 0;
  color: var(--muted);
  font-size: var(--text-sm);
}
```

- [ ] **Step 4：运行前端接线检查**

运行：`node scripts/check_announcements.mjs; node --check site/app/runtime.js; node --check site/app/boards.js`

预期：三个命令均以状态 0 结束，公告正文在插入模板前已通过 `escapeHtml()` 转义。

- [ ] **Step 5：提交首页接线和样式**

运行：`git add site/index.html site/app/runtime.js site/app/boards.js site/styles/home.css scripts/check_announcements.mjs && git commit -m "feat: show generated homepage announcements"`

预期：只提交公告的脚本加载、运行时数组、渲染、样式和检查改动。

### Task 4：把公告新鲜度纳入发布检查

**Files:**
- Modify: `scripts/check_announcements.mjs`
- Modify: `scripts/check_publish_bundle.mjs:1-19`

- [ ] **Step 1：为发布检查接线写入失败断言**

在 `scripts/check_announcements.mjs` 的 `checkFrontendContract()` 后添加：

```js
const publishCheck = fs.readFileSync(path.join(process.cwd(), "scripts", "check_publish_bundle.mjs"), "utf8");
assert.match(publishCheck, /from "\.\/lib\/announcements\.mjs"/);
assert.match(publishCheck, /announcements\.md/);
assert.match(publishCheck, /announcement-data\.js/);
assert.match(publishCheck, /announcement data is stale/);
```

- [ ] **Step 2：运行检查并确认发布检查尚未引用公告模块**

运行：`node scripts/check_announcements.mjs`

预期：命令以非零状态退出，断言 `check_publish_bundle.mjs` 未导入公告模块。

- [ ] **Step 3：实现发布包文件与新鲜度校验**

在 `scripts/check_publish_bundle.mjs` 的现有导入后加入：

```js
import { parseAnnouncements, serializeAnnouncements } from "./lib/announcements.mjs";
```

在 `root`、`siteRoot` 等路径常量后加入：

```js
const announcementsFile = path.join(root, "announcements.md");
const announcementDataFile = path.join(siteRoot, "announcement-data.js");
```

在 `requiredFiles` 初始集合加入 `"announcement-data.js"`。在 `for (const relative of [...requiredFiles].sort())` 循环前加入：

```js
if (!fs.existsSync(announcementsFile)) {
  failures.push("missing announcements.md");
} else if (!fs.existsSync(announcementDataFile)) {
  failures.push("missing published file: site/announcement-data.js");
} else {
  try {
    const expectedAnnouncementData = serializeAnnouncements(parseAnnouncements(fs.readFileSync(announcementsFile, "utf8")));
    const actualAnnouncementData = fs.readFileSync(announcementDataFile, "utf8");
    if (actualAnnouncementData !== expectedAnnouncementData) {
      failures.push("announcement data is stale; run node scripts/build_announcements_data.mjs");
    }
  } catch (error) {
    failures.push(`invalid announcements.md: ${error.message}`);
  }
}
```

- [ ] **Step 4：验证旧生成文件会阻止发布，并恢复文件**

运行以下 PowerShell 命令：

```powershell
$announcementPath = 'site\announcement-data.js'
$backupPath = "$announcementPath.bak"
Copy-Item -LiteralPath $announcementPath -Destination $backupPath
try {
  Add-Content -LiteralPath $announcementPath -Value ' '
  node scripts/check_publish_bundle.mjs
  if ($LASTEXITCODE -eq 0) { throw '发布检查没有识别旧公告数据。' }
} finally {
  Move-Item -LiteralPath $backupPath -Destination $announcementPath -Force
}
node scripts/check_publish_bundle.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```

预期：第一次检查报告 `announcement data is stale`；恢复后第二次检查输出 `publish_bundle: "ok"` 并以状态 0 结束。

- [ ] **Step 5：提交发布检查**

运行：`git add scripts/check_announcements.mjs scripts/check_publish_bundle.mjs && git commit -m "test: verify generated announcements before publish"`

预期：提交只包含公告发布新鲜度检查。

### Task 5：写明维护和发布方式并进行全量验证

**Files:**
- Modify: `README.md:部署章节前`

- [ ] **Step 1：在说明文件加入公告维护段落**

在 `README.md` 的“部署”标题前加入：

````markdown
## 站内公告

首页公告由仓库根目录的 `announcements.md` 维护。每条公告使用 `## YYYY-MM-DD｜标题` 作为标题行，标题后写正文；正文可以用空行分段。编辑完成后运行：

```powershell
node scripts/build_announcements_data.mjs
node scripts/check_announcements.mjs
node scripts/check_publish_bundle.mjs
```

三个命令通过后再上传 `site/` 目录。发布检查会拒绝与 `announcements.md` 不一致的 `site/announcement-data.js`。
````

- [ ] **Step 2：运行完整静态验证**

运行：`node scripts/build_announcements_data.mjs; node scripts/check_announcements.mjs; node scripts/check_publish_bundle.mjs; node --check scripts/lib/announcements.mjs; node --check scripts/build_announcements_data.mjs; node --check site/app/runtime.js; node --check site/app/boards.js; git diff --check`

预期：全部命令以状态 0 结束；公告检查输出 `announcement parser checks passed`，发布检查输出 `publish_bundle: "ok"`。

- [ ] **Step 3：核对本地首页的实际渲染**

运行：`node scripts/serve_site.mjs site 4173`

打开：`http://127.0.0.1:4173/#/home`

预期：首页公告栏按日期倒序显示两条初始公告；标题、日期和正文可见，公告栏在更多公告时保留纵向滚动；浏览器控制台没有 `VICDATA_ANNOUNCEMENTS` 未定义或脚本加载失败。

- [ ] **Step 4：提交说明和最终生成结果**

运行：`git add README.md announcements.md site/announcement-data.js && git commit -m "docs: document announcement publishing"`

预期：提交包含维护说明及与源文件一致的最终公告数据。
