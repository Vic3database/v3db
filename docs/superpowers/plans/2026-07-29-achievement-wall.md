# 成就总览板块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为原版 1.13.9 站点提供按难度分组、可搜索、带右侧详情栏的成就总览墙，并发布 141 张站内 WebP 图标。

**Architecture:** 提取器增加英文成就名，资料构建器把成就写成按需加载的独立数据块。前端新增专用成就渲染模块和样式，不复用既有筛选栏、地图或单列列表的结构；桌面端在同一页面内收窄总览墙并打开右侧详情栏，窄屏端用全屏详情页。维多利亚时代独立站未提供该数据块时隐藏入口，并将成就路由回退到首页。

**Tech Stack:** Node.js ES modules、现有浏览器原生 JavaScript、CSS Grid、Pillow、Playwright、Victoria 3 原版 1.13.9 本地文件。

---

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `scripts/extract_vic3_countries.mjs` | 同时读取简体中文和英文文本，导出 `name_en`。 |
| `scripts/build_achievement_assets.mjs` | 从数据库记录的原版 JPG 路径生成 141 张站内 WebP 图标。 |
| `scripts/build_wiki.mjs` | 把成就写入 `achievement` 数据块；缺少资料时返回空数组。 |
| `site/app/achievements.js` | 成就搜索、分组卡片、深链接、详情栏和窄屏滚动位置恢复。 |
| `site/styles/achievements.css` | 独立的全屏成就墙、低饱和难度色卡和响应式详情布局。 |
| `site/app/runtime.js`、`site/app/data.js`、`site/app/ui.js` | 维护成就运行时数据、路由和原版/独立站可用性。 |
| `site/index.html`、`site/styles.css`、`scripts/site_frontend_sources.mjs` | 注册顶栏入口、前端分段文件和样式入口。 |
| `scripts/check_achievement_database.mjs`、`scripts/check_achievement_board_contract.mjs`、`scripts/check_achievement_board_browser.mjs` | 分别校验原始资料、静态发布契约与实际浏览器行为。 |
| `scripts/check_data_chunking.mjs`、`scripts/check_publish_bundle.mjs`、`scripts/check_frontend_file_split.mjs` | 将新数据块、资源和分段文件纳入既有发布检查。 |
| `README.md` | 记录生成成就图标与站点数据的顺序。 |

### Task 1: 扩展成就资料并建立 WebP 图标构建器

**Files:**

- Modify: `scripts/extract_vic3_countries.mjs:135-183,1588-1652`
- Modify: `scripts/check_achievement_database.mjs:20-78`
- Create: `scripts/build_achievement_assets.mjs`
- Create: `scripts/check_achievement_board_contract.mjs`
- Create: `site/assets/achievements/*.webp`

- [ ] **Step 1: 先增加会失败的英文名和 WebP 资源断言**

在 `scripts/check_achievement_database.mjs` 的必填字段列表中加入 `name_en`，并在每项资料后要求英文名为非空字符串：

```js
for (const key of ["key", "name_zh", "name_en", "description_zh", "group_key", "group_name_zh", "group_order", "source_file"]) {
  assert.notEqual(achievement[key], undefined, `${achievement.key || "achievement"} must contain ${key}`);
  assert.notEqual(achievement[key], "", `${achievement.key || "achievement"} must contain ${key}`);
}
```

创建 `scripts/check_achievement_board_contract.mjs`，先读取 `site/versions/1.13.9/data-achievements.js`，并写入下列失败断言：

```js
const achievementChunk = readGlobal(path.join(root, "site", "versions", "1.13.9", "data-achievements.js"));
const achievements = achievementChunk.achievements || [];
assert.equal(achievements.length, 141, "achievement chunk must contain 141 records");
assert.deepEqual(countBy(achievements, (row) => row.group_key), {
  easy_group: 31,
  medium_group: 67,
  hard_group: 34,
  very_hard_group: 9,
});
for (const achievement of achievements) {
  assert(achievement.name_en, `${achievement.key} must include its English title`);
  assert(fs.existsSync(path.join(root, "site", "assets", "achievements", `${achievement.key}.webp`)), `${achievement.key} must have a published WebP icon`);
}
```

运行：`node scripts/check_achievement_database.mjs`

预期：失败，提示记录没有 `name_en`。

- [ ] **Step 2: 读取英文文本并写入稳定字段**

在提取器初始化处加载英文文本，并将其传给成就提取函数：

```js
const loc = loadLocalization(contentPath("localization", "simp_chinese"));
const locEn = loadLocalization(contentPath("localization", "english"));
// …
const achievements = loadAchievements(
  contentPath("common", "achievements"),
  contentPath("common", "achievement_groups.txt"),
  contentPath("gfx", "interface", "icons", "achievements"),
  loc,
  locEn,
);
```

将函数签名改为 `loadAchievements(definitionDirs, groupFiles, iconDirs, loc, locEn)`，在检查中文本地化的同一位置检查英文键，并在资料对象中固定写入 `name_en`：

```js
if (!loc.has(nameKey) || !loc.has(descriptionKey)) {
  throw new Error(`achievement Chinese localization is missing: ${key}`);
}
if (!locEn.has(nameKey)) {
  throw new Error(`achievement English localization is missing: ${key}`);
}

achievementsByKey.set(key, {
  id: `achievement:${key}`,
  key,
  name_zh: locCleanName(loc, nameKey),
  name_en: locCleanName(locEn, nameKey),
  description_zh: locCleanName(loc, descriptionKey),
  // 保留既有 details、script、icon 和 source_file 字段。
});
```

不得改变 `icon.achieved`、`icon.not_achieved` 的 JPG 源路径，也不得将 `achievement_placeholder` 加入资料。

- [ ] **Step 3: 实现单用途的图标转换脚本**

创建 `scripts/build_achievement_assets.mjs`。脚本默认读取 `database/vic3_1.13.9/index.json`，解析 `files.achievements` 和 `source_paths.game_data`，只接受 141 条 `icon.achieved` 为 `gfx/interface/icons/achievements/<key>.jpg` 的记录；输出目录固定为 `site/assets/achievements`。使用一个临时 JSON 清单和一次 Pillow 调用转换，图像保存为有损 WebP，参数为 `quality=88`、`method=6`，并在完成后核验输出文件名集合与 141 个资料键完全相同。

核心调用保持为：

```js
const result = spawnSync(python, ["-c", script, manifestFile], { encoding: "utf8", shell: false });
if (result.error || result.status !== 0) {
  throw new Error(`Unable to convert achievement icons using ${python}: ${result.error?.message || result.stderr || result.stdout}`.trim());
}
```

内嵌 Python 逐项打开 JPG，并写入同名 WebP：

```python
with Image.open(source) as image:
    image.convert("RGB").save(destination, "WEBP", quality=88, method=6)
```

脚本只创建和覆盖明确的 `site/assets/achievements/<key>.webp` 文件；不要递归删除 `site/assets/` 或其他资源目录。成功输出包含 `achievements: 141`、`asset_root` 和 `bytes`。

- [ ] **Step 4: 重新生成资料和图标，再验证通过**

运行：

```powershell
node scripts/extract_vic3_countries.mjs --game-path "D:\SteamLibrary\steamapps\common\Victoria 3" --version 1.13.9 --out output\vic3_1.13.9 --database database\vic3_1.13.9
node scripts/build_achievement_assets.mjs
node scripts/check_achievement_database.mjs
```

预期：提取器报告 `achievements: 141`；资料检查输出 `{ "achievement_database": "ok", "achievements": 141 }`；所有资料包含英文名，`Thanks, Obama` 等英文全称保持原样。

- [ ] **Step 5: 提交资料与图标构建基础**

运行：

```powershell
git add scripts/extract_vic3_countries.mjs scripts/check_achievement_database.mjs scripts/build_achievement_assets.mjs scripts/check_achievement_board_contract.mjs site/assets/achievements
git commit -m "feat: add achievement English names and webp assets"
```

预期：提交只含提取器、校验器、图标构建器和 141 张 WebP 图标；忽略的 `database/` 与 `output/` 不进入提交。

### Task 2: 将成就接入站点数据分块与发布检查

**Files:**

- Modify: `scripts/build_wiki.mjs:58-180,183-262`
- Modify: `site/app/runtime.js:15-45,150-165`
- Modify: `site/app/data.js:45-120,120-180`
- Modify: `scripts/check_data_chunking.mjs:16-45`
- Modify: `scripts/check_publish_bundle.mjs:162-205`
- Modify: `scripts/site_frontend_sources.mjs:4-25`
- Modify: `scripts/check_frontend_file_split.mjs:10-36`

- [ ] **Step 1: 为成就数据块写入失败检查**

在 `scripts/check_data_chunking.mjs` 的 `expectedChunks` 增加：

```js
achievement: ["achievements"],
```

在 `scripts/check_publish_bundle.mjs` 的 `dataAssetReferences()` 末尾增加预期断言所需的资源引用：

```js
for (const achievement of data.achievements || []) {
  if (achievement?.key) out.push(`assets/achievements/${achievement.key}.webp`);
}
```

运行：`node scripts/check_data_chunking.mjs`

预期：失败，提示缺少 `achievement` 数据块。

- [ ] **Step 2: 构建 `achievement` 数据块**

在 `scripts/build_wiki.mjs` 的 `loadSiteData()` 中读取可选的 `sourceData.files.achievements`，缺失时使用空数组；随后把 `achievements` 传入返回对象、`deriveSiteData()` 和 `wikiData`。增加数据块与文件名：

```js
const dataChunks = {
  // 保留既有块。
  technology: ["technologies", "technologyEras"],
  achievement: ["achievements"],
};

const dataChunkFileNames = {
  // 保留既有文件名。
  technology: "data-technologies.js",
  achievement: "data-achievements.js",
};
```

控制台统计追加 `achievements: wikiData.achievements.length`。不要把成就加入 `victorianCenturyChangeCollections`；它不属于本轮 Victorian Century 的差异标签范围。

- [ ] **Step 3: 在加载器中注册成就运行时数据**

在 `site/app/runtime.js` 增加：

```js
let achievements = [];
let achievementByKey = new Map();
// state 内：
selectedAchievement: "",
achievementSearch: "",
achievementWallScrollTop: 0,
```

在 `applyLoadedDataset()` 中建立：

```js
achievements = data.achievements || [];
achievementByKey = new Map(achievements.map((achievement) => [achievement.key, achievement]));
```

在 `site/app/data.js` 使 `dataChunksForView("achievement")` 返回 `["achievement"]`，且 `routeView()` 识别 `achievement`。数据块按现有 `for (const key of pending)` 顺序加载，不发起并行脚本请求。

- [ ] **Step 4: 更新前端分段与发布资源覆盖**

在 `scripts/site_frontend_sources.mjs` 和 `scripts/check_frontend_file_split.mjs` 的脚本清单中加入 `app/achievements.js`，在样式清单中加入 `styles/achievements.css`。`check_publish_bundle.mjs` 必须从 `data.achievements` 导出所有 WebP 路径，使任何缺失图标在发布前失败。

运行：

```powershell
node scripts/build_wiki.mjs --database database\vic3_1.13.9 --out site\versions\1.13.9
node scripts/check_data_chunking.mjs
node scripts/check_publish_bundle.mjs
```

预期：生成 `site/versions/1.13.9/data-achievements.js`；索引登记一项包含 `achievements: 141` 的分块；发布检查不报告缺失 WebP。

- [ ] **Step 5: 提交数据分块和发布约束**

运行：

```powershell
git add scripts/build_wiki.mjs site/app/runtime.js site/app/data.js scripts/check_data_chunking.mjs scripts/check_publish_bundle.mjs scripts/site_frontend_sources.mjs scripts/check_frontend_file_split.mjs site/versions/1.13.9
git commit -m "feat: publish achievement data chunk"
```

预期：站点 1.13.9 数据索引和新数据块已更新，发布检查可定位所有成就资源。

### Task 3: 接入独立的成就路由和总览渲染器

**Files:**

- Create: `site/app/achievements.js`
- Modify: `site/app/ui.js:1-90,900-1148`
- Modify: `site/app/runtime.js:514-525,655-725`
- Modify: `site/index.html:17-45,287-301`

- [ ] **Step 1: 为路由和页面契约写入失败检查**

在 `scripts/check_achievement_board_contract.mjs` 追加：

```js
assert.match(index, /data-nav-view="achievement"[^>]*>[\s\S]*?<span>成就<\/span>/, "top navigation must expose achievements");
assert.match(index, /data-nav-view="achievement"[^>]*>[\s\S]*?trophy\.svg/, "achievement navigation must use the trophy icon");
assert.match(app, /if \(view === "achievement"\) return \["achievement"\]/, "achievement route must load only its data chunk");
assert.match(app, /function renderAchievementBoard\(/, "achievement board renderer must exist");
assert.match(app, /function renderAchievementDetail\(/, "achievement detail renderer must exist");
assert.match(app, /\["country"[\s\S]*"achievement"\]/, "detail routes must accept achievement deep links");
```

运行：`node scripts/check_achievement_board_contract.mjs`

预期：失败，提示缺少成就渲染器和顶栏入口。

- [ ] **Step 2: 注册顶栏、可用性和深链接**

在顶栏科技后加入奖杯图标的 `data-nav-view="achievement"` 按钮，并在隐藏的 `#viewSelect` 添加 `value="achievement"` 的“成就”选项。脚本加载顺序采用：`runtime.js`、`data.js`、`ui.js`、既有模块、`components.js`、`achievements.js`、`bootstrap.js`，确保渲染时 `escapeHtml()` 和路由辅助函数已存在。

在 `viewLabels` 增加 `achievement: "成就"`。`applyHash()` 增加两种有效路由：

```js
if (parts[0] === "achievement" && !parts[1] && achievementBoardAvailable()) {
  changeBoard("achievement", "achievement");
  state.selectedAchievement = "";
  return;
}
if (parts[0] === "achievement" && parts[1] && achievementByKey.has(decodeURIComponent(parts[1]))) {
  changeBoard("achievement", "achievement");
  state.selectedAchievement = decodeURIComponent(parts[1]);
  return;
}
```

`achievementBoardAvailable()` 返回 `Boolean(dataIndex?.chunks?.achievement || achievements.length)`。在 `updatePageChrome()` 同步该结果到顶栏按钮和 `#viewSelect option` 的 `hidden` 属性；独立站没有成就分块时，`#/achievement` 走首页默认状态，不显示空成就墙。

- [ ] **Step 3: 实现专用总览和详情渲染器**

在 `site/app/achievements.js` 定义下列固定难度顺序和数据匹配函数：

```js
const achievementGroups = [
  ["easy_group", "简单"],
  ["medium_group", "中等"],
  ["hard_group", "困难"],
  ["very_hard_group", "极难"],
];

function achievementMatches(achievement, query) {
  const haystack = [
    achievement.name_zh,
    achievement.name_en,
    achievement.description_zh,
    ...(achievement.details || []).map((detail) => detail.text_zh),
  ].join("\n").toLocaleLowerCase("zh-Hans-CN");
  return !query || haystack.includes(query.toLocaleLowerCase("zh-Hans-CN"));
}
```

`renderAchievementBoard()` 在 `.results` 里写入局部搜索框、匹配总数和四个难度区块。每个区块标题显示 `简单 31 / 31` 形式的匹配数和总数；搜索后没有匹配项的组不输出。卡片只能包含 `<img>` 和一个单行中文名：

```js
<button class="achievement-card achievement-card--${groupKey}" type="button" data-achievement-key="${escapeHtml(achievement.key)}">
  <img src="assets/achievements/${escapeHtml(achievement.key)}.webp" alt="" aria-hidden="true">
  <span>${escapeHtml(achievement.name_zh)}</span>
</button>
```

不得在卡片插入英文名、难度数字、说明、条件或原始脚本。输入事件只修改 `state.achievementSearch`，不写入哈希；点击卡片先保存 `.results.scrollTop` 到 `state.achievementWallScrollTop`，再写入 `#/achievement/<encodeURIComponent(key)>`。清除搜索词时将保存的滚动位置设为 `0`。

`renderAchievementDetail()` 只在选择有效成就时写入 `els.detail`。内容顺序固定为 WebP 图标、中文名、英文全称、难度名、官方中文说明、逐条中文条件、`possible`、`happened`。两个脚本使用 `<details open>` 和 `<pre>`；`possible === null` 显示“原版未定义前置筛选条件”，不得生成空代码块。详情不输出 `source_file`。关闭按钮改写哈希为 `#/achievement`；在窄屏关闭后用 `requestAnimationFrame()` 恢复已保存的滚动位置。

- [ ] **Step 4: 接进统一渲染分派**

在 `render()` 中把 `achievement` 分派到 `renderAchievementBoard()`，并将它加入 `boardManagesDetail`，使专用渲染器自行管理右栏。`detailRouteKey()` 的路由白名单加入 `achievement`。通用筛选、地图、排序和左侧面板继续保留给既有板块，但成就视图不读取或修改它们。

运行：

```powershell
node --check site\app\runtime.js
node --check site\app\data.js
node --check site\app\ui.js
node --check site\app\achievements.js
node scripts/check_achievement_board_contract.mjs
```

预期：所有语法检查通过；静态契约确认奖杯入口、独立数据块、搜索字段、深链接和默认展开的脚本区块都存在。

- [ ] **Step 5: 提交交互逻辑**

运行：

```powershell
git add site/index.html site/app/runtime.js site/app/data.js site/app/ui.js site/app/achievements.js scripts/check_achievement_board_contract.mjs scripts/site_frontend_sources.mjs scripts/check_frontend_file_split.mjs
git commit -m "feat: add achievement wall interactions"
```

预期：提交提供独立成就路由、卡片搜索和详情内容，但尚未依赖旧版列表模板的 CSS。

### Task 4: 实现总览墙、色卡与响应式详情布局

**Files:**

- Create: `site/styles/achievements.css`
- Modify: `site/styles.css:1-9`
- Modify: `scripts/check_achievement_board_contract.mjs`

- [ ] **Step 1: 为视觉布局写入失败断言**

在 `scripts/check_achievement_board_contract.mjs` 追加：

```js
assert.match(styles, /body\[data-view="achievement"\] \.map-panel,[\s\S]*?display: none/, "achievement view must hide the map and filters");
assert.match(styles, /grid-template-columns:\s*repeat\(12, minmax\(0, 1fr\)\)/, "full achievement wall must use twelve desktop columns");
assert.match(styles, /body\.detail-page\[data-view="achievement"\][\s\S]*?repeat\(10, minmax\(0, 1fr\)\)/, "open desktop detail must retain ten card columns");
assert.match(styles, /achievement-card--easy_group[\s\S]*?#4a4840/, "easy cards must use dark stone gray");
assert.match(styles, /achievement-card--medium_group[\s\S]*?#4d372b/, "medium cards must use deep copper brown");
assert.match(styles, /achievement-card--hard_group[\s\S]*?#384651/, "hard cards must use dark silver blue gray");
assert.match(styles, /achievement-card--very_hard_group[\s\S]*?#4b4727/, "very hard cards must use dark gold olive");
```

运行：`node scripts/check_achievement_board_contract.mjs`

预期：失败，提示缺少成就样式。

- [ ] **Step 2: 建立桌面端全屏墙和低饱和色卡**

在 `site/styles/achievements.css` 以 `body[data-view="achievement"]` 为作用域，隐藏 `.map-panel`、`.filters`、通用 `.result-head` 和地图工具；让 `.results` 占据顶栏以下的整个内容区，成为可滚动的半透明深色表面。`detail-page` 未激活时隐藏 `.detail`；激活后，`.results` 右侧留出 `min(30rem, 32vw)`，`.detail` 固定在右侧并独立滚动，不覆盖总览墙。

总览卡片采用近方形 Grid：

```css
.achievement-wall-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 10px;
}

body.detail-page[data-view="achievement"] .achievement-wall-grid {
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 8px;
}

.achievement-card {
  aspect-ratio: 1 / 1;
  min-width: 0;
  border: 1px solid rgba(238, 232, 221, .14);
  color: var(--ink);
  transition: transform .14s ease, border-color .14s ease, box-shadow .14s ease;
}

.achievement-card:hover,
.achievement-card:focus-visible {
  z-index: 1;
  transform: scale(1.045);
  border-color: var(--accent);
  box-shadow: 0 0 0 1px rgba(200, 164, 91, .42), 0 12px 24px rgba(0, 0, 0, .34);
}
```

使用下列深色底色，图标放在同色系更深的内层，中文名使用单行省略：`easy_group #4a4840`、`medium_group #4d372b`、`hard_group #384651`、`very_hard_group #4b4727`。禁止使用国家集团授权框的边框图案、等级数字或原图。

- [ ] **Step 3: 实现窄屏全屏详情**

在 `@media (max-width: 1100px)` 中保留无详情时的多列卡片墙；当 `body.detail-page[data-view="achievement"]` 生效时隐藏 `.results`，让 `.detail` 以 `inset: 0` 覆盖内容区并保留返回按钮。详情文本采用站点的宋体、米白正文和金色交互色；`pre` 允许横向滚动，防止原始脚本被改写。卡片标题、区块标题、搜索框与详情栏均使用现有 `--surface`、`--panel-glass`、`--ink`、`--accent` 变量。

在 `site/styles.css` 末尾导入：

```css
@import url("styles/achievements.css?v=20260729-achievement-wall1");
```

运行：

```powershell
node scripts/check_frontend_file_split.mjs
node scripts/check_achievement_board_contract.mjs
git diff --check
```

预期：分段检查与成就静态检查通过，`git diff --check` 无输出。

- [ ] **Step 4: 提交视觉实现**

运行：

```powershell
git add site/styles.css site/styles/achievements.css scripts/check_achievement_board_contract.mjs scripts/site_frontend_sources.mjs scripts/check_frontend_file_split.mjs
git commit -m "feat: style achievement wall and detail pane"
```

预期：提交只含成就墙样式和相应契约断言。

### Task 5: 浏览器回归、生成说明与最终验证

**Files:**

- Create: `scripts/check_achievement_board_browser.mjs`
- Modify: `README.md:36-63`
- Modify: `scripts/check_achievement_board_contract.mjs`

- [ ] **Step 1: 编写浏览器验收脚本**

创建 `scripts/check_achievement_board_browser.mjs`，沿用现有 Playwright 初始化方式，并收集 `console` error 与 `pageerror`。脚本在 1440×1000 页面完成以下断言：

```js
await page.goto(`${baseUrl}#/achievement`, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForSelector("[data-achievement-key]", { timeout: 20000 });
assert.equal(await page.locator("[data-achievement-key]").count(), 141);
assert.equal(await page.locator(".achievement-group").count(), 4);
assert.equal(await page.locator("#mapPanel").isVisible(), false);
assert.equal(await page.locator(".filters").isVisible(), false);
```

向局部搜索框输入 `Thanks, Obama`，断言仅保留 `data-achievement-key="achievement_thanks_obama"` 及其非空分组；点击该卡片后断言地址为 `#/achievement/achievement_thanks_obama`，详情包含英文名、官方说明、条件、两个打开的 `<details open>`，并在右栏打开时通过 `getComputedStyle(grid).gridTemplateColumns.split(" ").length` 断言为 10 列。点击关闭按钮后断言搜索词和总览仍在。

再创建 390×844 页面，打开同一成就深链接，断言 `.results` 不可见、`.detail` 可见；关闭后断言总览重新可见，且页面没有 console error。

- [ ] **Step 2: 记录可复现构建顺序**

在 `README.md` 的本地构建说明中加入以下顺序，说明第一个命令更新资料，第二个命令生成站内 WebP，第三个命令生成网站数据块：

```powershell
node scripts/extract_vic3_countries.mjs --game-path "D:\SteamLibrary\steamapps\common\Victoria 3" --version 1.13.9 --out output\vic3_1.13.9 --database database\vic3_1.13.9
node scripts/build_achievement_assets.mjs
node scripts/build_wiki.mjs --database database\vic3_1.13.9 --out site\versions\1.13.9
```

同一段落列出 `node scripts/check_achievement_database.mjs`、`node scripts/check_achievement_board_contract.mjs` 与 `node scripts/check_publish_bundle.mjs`，并说明 `database/` 与 `output/` 为本地生成资料，不纳入提交。

- [ ] **Step 3: 运行完整静态和浏览器验证**

运行：

```powershell
node scripts/check_achievement_database.mjs
node scripts/check_data_chunking.mjs
node scripts/check_achievement_board_contract.mjs
node scripts/check_frontend_file_split.mjs
node scripts/check_publish_bundle.mjs
node --check scripts/build_achievement_assets.mjs
node --check scripts/build_wiki.mjs
node --check site/app/achievements.js
$server = Start-Process -FilePath python -ArgumentList "-m","http.server","4173","--directory","site" -PassThru -WindowStyle Hidden
try { node scripts/check_achievement_board_browser.mjs "http://127.0.0.1:4173/index.html" } finally { Stop-Process -Id $server.Id }
git diff --check
```

预期：所有命令状态为 0；浏览器脚本输出 `achievement_board_browser: "ok"`，无控制台错误；发布检查确认数据块和 141 张 WebP 都在 `site/` 中。

- [ ] **Step 4: 提交验证与说明**

运行：

```powershell
git add scripts/check_achievement_board_browser.mjs scripts/check_achievement_board_contract.mjs README.md
git commit -m "test: verify achievement wall in browser"
git status --short
```

预期：工作树不包含本轮需提交的改动；既有用户未跟踪文件仍保持原状。
