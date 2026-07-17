# 科技板块实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Vicdata 增加可按方向和时代浏览、可查看前置关系与解锁内容的科技板块。

**Architecture:** 扩展现有 `extract_vic3_countries.mjs`，从游戏科技定义和本地化生成 `technologies.json` 与时代成本记录，并将该字段作为单独的 `technology` 数据块写入 `site/versions/<版本>`。`site/app.js` 将科技作为独立路由和画布式页面渲染，桌面端绘制全宽关系图，窄屏端改用时代列表和局部关系图。

**Tech Stack:** Node.js、现有 Clausewitz 解析器、静态 JavaScript、HTML、CSS、Node `assert` 检查脚本。

---

### Task 1: 生成科技数据库记录

**Files:**

- Modify: `scripts/extract_vic3_countries.mjs:main`, `scripts/extract_vic3_countries.mjs:writeDatabase`
- Create: `scripts/check_technology_database.mjs`
- Modify: `database/vic3_1.13.9/index.json`
- Create: `database/vic3_1.13.9/technologies.json`

- [ ] **Step 1: 写入数据库结构检查，并确认当前数据不包含科技文件**

在 `scripts/check_technology_database.mjs` 中先断言当前数据库入口必须出现 `files.technologies`、`files.technology_eras`，并读取两个 JSON 文件。检查科技记录包含 `id`、`key`、`name_zh`、`desc_zh`、`icon`、`category`、`category_zh`、`era`、`era_cost`、`prerequisites`、`unlocks`、`modifiers`、`source_file`；检查时代记录为 `era_1` 至 `era_5`，成本依次为 `7500`、`10000`、`12500`、`15000`、`17500`。

Run: `node scripts/check_technology_database.mjs`

Expected: FAIL，提示缺少科技入口或科技文件。

- [ ] **Step 2: 在抽取器中载入时代和科技定义**

在 `main()` 中、载入法律之后增加：

```js
const technologyEras = loadTechnologyEras(contentPath("common", "technology", "eras"));
const technologies = loadTechnologies(
  contentPath("common", "technology", "technologies"),
  technologyEras,
  loc,
);
attachTechnologyReferences(technologies, { laws, companies });
```

新增 `loadTechnologyEras(dir)`：遍历 `.txt`，读取 `era_1` 至 `era_5`，输出 `{ key, label_zh, cost }`，其中标签固定为“时代 I”至“时代 V”。新增 `loadTechnologies(dir, eras, loc)`：使用已有 `parseScript`、`asNode`、`firstScalar`、`firstValue`、`nodeItems`、`modifierRef` 和 `normalizePath`，解析每项科技的 `era`、`texture`、`category`、`unlocking_technologies` 与所有 `modifier`；分类标签映射为 `production: "生产"`、`military: "军事"`、`society: "社会"`。每条记录使用 `locCleanName(loc, key)` 与 `${key}_desc` 的中文本地化，前置关系保存为 `prerequisites`，反向关系初始为空。

- [ ] **Step 3: 在生成阶段建立反向关系与关联对象**

新增 `attachTechnologyReferences(technologies, { laws, companies })`。先创建 `Map(technologies.map((technology) => [technology.key, technology]))`；对每个 `prerequisites` 键名确认目标存在，然后将当前科技的 `{ key, name_zh }` 写入前置科技的 `unlocks`。再为每项科技写入：

```js
technology.references = {
  laws: laws.values().filter((law) => law.unlocking_technologies.some((item) => item.key === technology.key))
    .map((law) => ({ key: law.key, name_zh: law.name_zh })),
  companies: companies.filter((company) => company.required_technologies.some((item) => item.key === technology.key))
    .map((company) => ({ key: company.key, name_zh: company.name_zh })),
};
```

按 `name_zh` 排序每个反向关系和关联对象数组。某个前置键名无法解析时抛出带科技键名的错误，避免生成断裂图。

- [ ] **Step 4: 将科技数据写入数据库入口**

在 `writeDatabase` 的 `files`、`counts` 和逐文件写入逻辑中加入：

```js
technologies: "technologies.json",
technology_eras: "technology_eras.json",
```

以及对应数组和数量。重新生成 1.13.9 数据库：

Run: `node scripts/extract_vic3_countries.mjs --version 1.13.9 --database database/vic3_1.13.9 --out output`

Expected: 退出码 0，`database/vic3_1.13.9/technologies.json` 和 `technology_eras.json` 存在。

- [ ] **Step 5: 运行科技数据库检查**

补全检查：三个分类均至少一项科技；五个时代均至少一项科技；每项前置和反向关系互相对应；图标路径以 `gfx/interface/icons/invention_icons/` 开头；`era_cost` 与对应时代成本相等；法律、公司引用只指向已生成科技。

Run: `node scripts/check_technology_database.mjs`

Expected: 输出 JSON，含 `technology_database: "ok"`、科技总数与三类数量。

- [ ] **Step 6: 提交数据抽取改动**

Run: `git add scripts/extract_vic3_countries.mjs scripts/check_technology_database.mjs database/vic3_1.13.9/index.json database/vic3_1.13.9/technologies.json database/vic3_1.13.9/technology_eras.json && git commit -m "feat: extract technology data"`

### Task 2: 将科技加入站点数据分块和导航

**Files:**

- Modify: `scripts/build_wiki.mjs:wikiData`, `scripts/build_wiki.mjs:dataChunks`, `scripts/build_wiki.mjs:loadSiteData`
- Modify: `site/app.js:dataChunksForView`, `site/app.js:routeView`, `site/app.js:applyHash`, `site/app.js:setView`, `site/app.js:renderHomeBoard`
- Modify: `scripts/check_data_chunking.mjs`
- Create: `scripts/check_technology_board_contract.mjs`
- Modify: `site/versions/1.13.9/data-index.js`
- Create: `site/versions/1.13.9/data-technologies.js`

- [ ] **Step 1: 扩展分块检查，并确认首轮失败**

在 `scripts/check_data_chunking.mjs` 的 `expectedChunks` 中加入：

```js
technology: ["technologies", "technologyEras"],
```

Run: `node scripts/check_data_chunking.mjs`

Expected: FAIL，提示缺少 `technology` 数据块。

- [ ] **Step 2: 将数据库科技字段读入 `build_wiki.mjs`**

在 `loadSiteData()` 中从 `sourceData.files.technologies` 和 `sourceData.files.technology_eras` 读取数组；在返回对象、`deriveSiteData()`、`wikiData` 中分别使用 camelCase 字段 `technologies` 与 `technologyEras`。保持缺失字段返回空数组的现有兼容行为。

- [ ] **Step 3: 输出独立科技数据块并更新索引**

在 `dataChunks` 与 `dataChunkFileNames` 中加入：

```js
technology: ["technologies", "technologyEras"],
technology: "data-technologies.js",
```

运行构建：

Run: `node scripts/build_wiki.mjs --database database/vic3_1.13.9 --out site/versions/1.13.9`

Expected: 退出码 0，索引中科技块仅有 `data-technologies.js`，且该文件仅导出 `technologies` 与 `technologyEras`。

- [ ] **Step 4: 加入路由和主页入口**

在 `site/app.js` 中为 `viewLabels` 加入 `technology: "科技"`；`dataChunksForView("technology")` 仅返回 `["technology"]`；`routeView()` 识别 `technology`；`applyHash()` 处理 `#/technology` 和 `#/technology/<键名>`，后者验证 `technologyByKey`；`setView()` 保持科技路由的详情种类。主页科技条目从“筹备中”改为 `view: "technology"`，副文本使用 `dataCount("technologies", technologies)`。

- [ ] **Step 5: 写入静态路由契约检查**

在 `scripts/check_technology_board_contract.mjs` 读取 `site/app.js` 与 `site/styles.css`，断言存在 `technology` 路由、`technology` 数据块选择、主页 `data-home-view`、科技渲染函数、桌面画布类、窄屏局部关系类、节点选择属性和详情跳转属性。先运行检查：

Run: `node scripts/check_technology_board_contract.mjs`

Expected: FAIL，提示缺少科技渲染函数或相关类。

- [ ] **Step 6: 运行分块检查并提交**

Run: `node scripts/check_data_chunking.mjs`

Expected: 输出 `data_chunking: "ok"`，包含 `technology`。

Run: `git add scripts/build_wiki.mjs scripts/check_data_chunking.mjs site/app.js scripts/check_technology_board_contract.mjs site/versions/1.13.9 && git commit -m "feat: publish technology data chunk"`

### Task 3: 实现科技关系图与详情内容

**Files:**

- Modify: `site/app.js:state`, `site/app.js:applyLoadedDataset`, `site/app.js:render`, `site/app.js:renderDetailForState`
- Modify: `site/styles.css`
- Modify: `site/index.html`（只更新 `app.js` 与 `styles.css` 的缓存参数）
- Modify: `scripts/check_technology_board_contract.mjs`

- [ ] **Step 1: 为科技数据和选择状态建立索引**

在 `data` 默认值、解构数组和 `applyLoadedDataset()` 中加入 `technologies`、`technologyEras` 与 `technologyByKey`。在 `state` 中加入：

```js
selectedTechnology: "",
technologyCategory: "production",
technologyViewport: { x: 0, y: 0, scale: 1 },
```

加载数据后，将默认方向设为当前数据中存在的第一个分类；哈希键名有效时同步 `selectedTechnology`。

- [ ] **Step 2: 实现稳定的五列节点布局与边数据**

新增 `technologyGraphLayout(category)`。按 `era` 分为五列，每列按前置科技数量、名称排序；每个节点返回 `{ key, x, y, width, height, technology }`。坐标使用固定列宽与行高，画布大小由最大列高度计算。新增 `technologyGraphEdges(layout)`，只返回同分类、前置键名可解析的 `{ from, to, highlighted }`；高亮条件为当前科技、其直属前置或直属后续节点参与的边。

- [ ] **Step 3: 实现桌面关系图和详情栏**

新增 `renderTechnologyBoard()`。输出方向按钮、五个时代跳转按钮、重置视图按钮、`technology-graph-viewport`、内部 `technology-graph-canvas`、SVG 连线层和节点按钮。节点按钮保留 `data-technology-key`，包含图标、中文名和时代；选择节点时写入 `location.hash = "/technology/<键名>"`，随后调用现有 `applyHash()` 与 `render()`。

新增 `renderTechnologyDetail(technology)`，依次渲染分类、时代、成本、说明、前置科技、后续科技、修正效果、关联法律和关联公司。科技关系按钮使用 `data-technology-target`；法律与公司使用既有 `/law/<key>`、`/company/<key>` 路由。未选择节点时详情栏显示“选择一项科技查看前置关系与解锁内容”。

- [ ] **Step 4: 加入画布拖拽、缩放和时代跳转**

为视口绑定 `pointerdown`、`pointermove`、`pointerup`、`wheel`。拖拽只更新 `technologyViewport.x/y`；滚轮以 `0.7` 至 `1.8` 为界更新 `scale` 并阻止页面滚动；重置为 `{ x: 0, y: 0, scale: 1 }`；时代按钮将对应列中心移动到视口中心。每次状态改变只更新画布的 CSS `transform`，不重新排序科技数据。

- [ ] **Step 5: 编写窄屏时代列表与局部关系图**

在 `renderTechnologyBoard()` 同时输出 `technology-mobile-list`。按五个时代使用 `<details>` 分组，包含可选科技按钮。`technology-local-graph` 只渲染选中科技、直属前置和直属后续节点，以及这些节点与中心节点之间的边。CSS 在 `max-width: 900px` 下隐藏全宽画布与桌面控制栏，显示时代列表、局部关系图和详情；在较宽尺寸反向隐藏窄屏元素。

- [ ] **Step 6: 完成静态检查并更新缓存参数**

在 `scripts/check_technology_board_contract.mjs` 中加入对 `technologyGraphLayout`、`technologyGraphEdges`、`renderTechnologyBoard`、`renderTechnologyDetail`、`data-technology-key`、`data-technology-target`、`technology-graph-viewport`、`technology-local-graph`、拖拽与滚轮事件、窄屏媒体查询的断言。更新 `site/index.html` 中 app 与样式资源的版本参数。

Run: `node --check site/app.js && node scripts/check_technology_board_contract.mjs`

Expected: 两个命令退出码 0，检查输出 `technology_board_contract: "ok"`。

- [ ] **Step 7: 提交界面实现**

Run: `git add site/app.js site/styles.css site/index.html scripts/check_technology_board_contract.mjs && git commit -m "feat: add technology relationship board"`

### Task 4: 端到端回归与浏览器核验

**Files:**

- Modify: `scripts/check_publish_bundle.mjs`（仅在现有发布检查未覆盖科技数据块时）
- Modify: `WORKLOG.md`

- [ ] **Step 1: 运行全部静态检查**

Run: `node scripts/check_technology_database.mjs && node scripts/check_data_chunking.mjs && node scripts/check_technology_board_contract.mjs && node scripts/check_publish_bundle.mjs && node --check site/app.js && git diff --check`

Expected: 每个命令退出码 0；所有检查输出正常状态；`git diff --check` 无空白错误。

- [ ] **Step 2: 用本地静态服务器检查桌面端**

Run: `node --input-type=module -e "import { createServer } from 'node:http'; import { readFileSync, statSync } from 'node:fs'; import { extname, join } from 'node:path'; createServer((req,res)=>{let p=join(process.cwd(),'site',decodeURIComponent(req.url.split('?')[0]||'/'));if(p.endsWith('\\')||p.endsWith('/'))p=join(p,'index.html');try{if(statSync(p).isDirectory())p=join(p,'index.html');res.end(readFileSync(p));}catch{res.statusCode=404;res.end('not found')}}).listen(8010)"`

在浏览器打开 `http://127.0.0.1:8010/#/technology`，确认主页入口进入科技页；依次点生产、军事、社会；确认时代 I 至 V 都存在；选择一项带前置条件的科技，确认详情中的前置、后续与高亮边对应；点击详情中的后续科技，确认哈希、选择节点和焦点均更新；检查控制台无错误、网络无失败图标请求。

- [ ] **Step 3: 用窄屏尺寸检查降级界面**

把浏览器视口设为 390 × 844，重新打开 `#/technology`。确认完整画布隐藏，按时代列表与局部关系图可见；选择同一项科技后，前置和后续节点仍可点击，详情内容完整，页面没有水平溢出。

- [ ] **Step 4: 记录核验结果并提交**

以 UTF-8 向 `WORKLOG.md` 追加本次科技数据来源、科技总数、检查命令与桌面/窄屏浏览器结果。

Run: `git add scripts/check_publish_bundle.mjs WORKLOG.md && git commit -m "test: verify technology board"`
