# Victorian Century 独立站前端同步实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Victorian Century 独立站切换至主站的模块化前端，同时只加载本地 VC 数据、地图和资源。

**Architecture:** 新增一个可重复执行的独立站构建脚本，以主站前端目录为模板同步模块、样式和共用资源，再写入 VC 专用入口页和本地加载配置。VC 专用配置令数据加载器从 `data-index.js`、数据分块和 `map-data.js` 读取数据，不依赖版本列表、公告、新闻或更新日志。

**Tech Stack:** Node.js、浏览器原生 JavaScript、PowerShell、本地静态服务器、Python Pillow。

---

### Task 1: 为 VC 本地加载配置建立失败检查

**Files:**
- Create: `scripts/check_victorian_century_standalone_site.mjs`
- Test: `scripts/check_victorian_century_standalone_site.mjs`

- [ ] **Step 1: 写入失败检查**

检查 `Victorian Century Database/index.html` 是否仅加载本地前端脚本与 `victorian-century-config.js`，是否不含版本选择、公告、新闻、更新日志；检查配置指向 `data-index.js`、`map-data.js` 和本地数据分块；检查 `app/data.js` 具有独立站加载分支。

- [ ] **Step 2: 运行检查并确认失败原因是文件尚未生成**

运行：`node scripts/check_victorian_century_standalone_site.mjs`

预期：失败信息指出缺少 `victorian-century-config.js` 或模块化加载入口。

### Task 2: 实现可重复执行的独立站前端构建器

**Files:**
- Create: `scripts/build_victorian_century_site.mjs`
- Create: `Victorian Century Database/victorian-century-config.js`（生成文件）
- Modify: `Victorian Century Database/index.html`（生成文件）
- Modify: `Victorian Century Database/app/data.js`（生成文件）

- [ ] **Step 1: 同步主站模块、样式和资源**

构建器复制 `site/app/`、`site/styles/`、`site/styles.css` 和 `site/assets/` 到 `Victorian Century Database/`，保留 VC 的数据文件、地图索引和 VC 专用图像覆盖。

- [ ] **Step 2: 生成 VC 专用入口与配置**

从 `site/index.html` 生成入口页，移除版本选择、公告、新闻与更新日志脚本及控件；写入 Victorian Century 标题、说明和仅本地数据的配置。配置固定数据索引、地图索引、数据分块根目录和站点名称。

- [ ] **Step 3: 使复制后的数据加载器支持配置**

当存在 VC 配置时，数据加载器读取 `data-index.js` 和 `map-data.js`，按照当前路由加载根目录的数据分块；配置不存在时保留主站版本化加载行为。

- [ ] **Step 4: 运行失败检查并确认通过**

运行：`node scripts/build_victorian_century_site.mjs && node scripts/check_victorian_century_standalone_site.mjs`

预期：构建器输出已同步文件统计；静态检查通过。

### Task 3: 接入 VC 专用素材同步与更新流程

**Files:**
- Modify: `scripts/build_victorian_century_site.mjs`
- Modify: `scripts/check_victorian_century_update.mjs`
- Test: `scripts/check_victorian_century_standalone_site.mjs`

- [ ] **Step 1: 将 VC 资源同步纳入构建器**

构建器在复制主站资源后调用 `scripts/sync_victorian_century_assets.py`，让 VC 新增公司、法律、意识形态和名贵商品图标覆盖共用资源。

- [ ] **Step 2: 将独立站构建器纳入数据更新脚本**

在成功更新数据库与地图后执行构建器。保留兼容 `data.js`，不让模块化页面引用该文件。

- [ ] **Step 3: 验证更新脚本的静态语法和独立站检查**

运行：`node --check scripts/check_victorian_century_update.mjs && node --check scripts/build_victorian_century_site.mjs && node scripts/check_victorian_century_standalone_site.mjs`

预期：三项检查通过。

### Task 4: 验证数据分块、资源和页面壳层

**Files:**
- Test: `scripts/check_victorian_century_standalone_site.mjs`
- Test: `scripts/sync_victorian_century_assets.py`

- [ ] **Step 1: 检查独立站数据分块和地图索引**

运行：`node scripts/check_data_chunking.mjs --site-dir "Victorian Century Database"`；若脚本不支持该参数，则以 Node VM 读取 `data-index.js`、数据分块和 `map-data.js`，检查七类分块和 8192×3616 地图索引。

- [ ] **Step 2: 检查 VC 新增图像素材**

运行：`<bundled-python> scripts/sync_victorian_century_assets.py --check --json`

预期：公司 10、法律 6、意识形态 2、名贵商品 24、WebP 18，且无失败项。

### Task 5: 浏览器回归检查

**Files:**
- Test: `Victorian Century Database/index.html`

- [ ] **Step 1: 启动独立站本地服务器**

使用端口 8877 提供 `Victorian Century Database/`。

- [ ] **Step 2: 检查首页与八个板块**

确认标题和说明为 Victorian Century；顶栏没有版本、公告或更新日志入口；首页、国家、文化、地区、公司、意识形态、法律、科技可打开。

- [ ] **Step 3: 检查地图与控制台**

确认地图显示、地区焦点可重置，控制台没有页面错误。
