# Vicdata WebP 图片资源优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为地图展示底图、建筑、公司、法律和意识形态配图提供 WebP 优先加载与 PNG 回退，降低图片下载体积。

**Architecture:** Python Pillow 将选定 PNG 增量转换为同目录 WebP；前端集中生成 `picture` 标记，使展示图片优先请求 WebP 并保留原 PNG 回退。地图展示底图使用候选地址顺序加载；像素取色的 `provinces.png` 不改变路径或格式。

**Tech Stack:** Python 3、Pillow 12.1.1、Node.js 24、浏览器原生 `picture` 与 `source`。

---

### Task 1: 建立转换与完整性检查

**Files:**

- Create: `scripts/convert_site_display_images.py`
- Create: `scripts/check_webp_asset_conversion.py`

- [ ] **Step 1: 写出失败的图片完整性检查**

在 `scripts/check_webp_asset_conversion.py` 固定范围：`map/flatmap_votp.png` 质量 80；`buildings/**/*.png`、`companies/**/*.png`、`laws/**/*.png`、`ideologies/**/*.png` 质量 85。遍历目标 PNG，断言每个文件都有同名 `.webp`，再用 Pillow 断言两者宽高相同。断言 `site/assets/map/provinces.png` 存在且 `site/assets/map/provinces.webp` 不存在。失败时输出缺失相对路径并以状态码 1 退出；成功时输出目录文件数与两种格式字节数的 JSON。

- [ ] **Step 2: 运行检查，确认它失败**

运行 `python scripts/check_webp_asset_conversion.py`。预期失败，报告每个目标目录缺少 WebP 文件。

- [ ] **Step 3: 实现增量转换脚本**

在 `scripts/convert_site_display_images.py` 使用相同目录清单，目标为 `source.with_suffix(".webp")`。目标不存在或修改时间早于 PNG 时使用 Pillow 的 `image.save(target, "WEBP", quality=quality, method=6, exact=True)`。不删除 PNG，也不扫描国旗、特质、首页、品牌、DLC、威望商品和 `provinces.png`。输出每个目录的 `source_files`、`converted`、`skipped`、`png_bytes`、`webp_bytes` 与 `saved_bytes` JSON 汇总。

- [ ] **Step 4: 生成资源并通过检查**

运行 `python scripts/convert_site_display_images.py`，随后运行 `python scripts/check_webp_asset_conversion.py`。预期生成 5 个范围的 WebP，完整性检查输出 `webp_asset_conversion: "ok"`。

- [ ] **Step 5: 提交转换工具与生成资源**

运行 `git add scripts/convert_site_display_images.py scripts/check_webp_asset_conversion.py site/assets/map/flatmap_votp.webp site/assets/buildings site/assets/companies site/assets/laws site/assets/ideologies`，随后运行 `git commit -m "feat: generate WebP display assets"`。

### Task 2: 接入 WebP 优先加载

**Files:**

- Modify: `site/app.js:66-81`
- Modify: `site/app.js:4160-4185`
- Modify: `site/app.js:7445-7537`
- Create: `scripts/check_webp_image_markup.mjs`

- [ ] **Step 1: 写出失败的前端契约检查**

在 `scripts/check_webp_image_markup.mjs` 读取 `site/app.js`，断言存在 `webpPictureHtml`、`loadImageCandidates`、`flatmap_votp.webp`、`flatmap_votp.png`，并断言 `mapRuntime.imageUrl` 仍为 `assets/map/provinces.png`。断言 `lawIconHtml`、`buildingIconHtml`、`companyIconHtml`、`ideologyIconHtml` 均调用 `webpPictureHtml`；`countryFlagIconHtml`、`interestGroupIconHtml`、`goodsIconHtml` 不调用它。

- [ ] **Step 2: 运行检查，确认它失败**

运行 `node scripts/check_webp_image_markup.mjs`。预期失败，指出尚未定义 WebP 图片辅助函数。

- [ ] **Step 3: 实现集中标记与地图候选加载**

在 `site/app.js` 添加 `webpAssetPath(pngPath)`、`webpPictureHtml(options)` 与 `loadImageCandidates(sources)`。前者把扩展名 `.png` 变为 `.webp`；标记函数生成 WebP `source` 加 PNG `img` 回退，所有属性采用既有 `escapeHtml`；候选加载按顺序请求 URL，WebP 失败后才请求 PNG。将 `paperMapUrl` 替换为 `paperMapUrls: ["assets/map/flatmap_votp.webp", "assets/map/flatmap_votp.png"]`，并在 `ensureMapLoaded` 中调用候选加载；保留 `imageUrl: "assets/map/provinces.png"`。将 `lawIconHtml`、`buildingIconHtml`、`companyIconHtml`、`ideologyIconHtml` 改为调用 `webpPictureHtml`，意识形态 `<img>` 继续带原有 `no_ideology.png` 错误回退。

- [ ] **Step 4: 运行前端静态检查**

运行 `node --check site/app.js`、`node scripts/check_webp_image_markup.mjs` 和 `python scripts/check_webp_asset_conversion.py`。预期全部成功。

- [ ] **Step 5: 提交页面接入与检查脚本**

运行 `git add site/app.js scripts/check_webp_image_markup.mjs`，随后运行 `git commit -m "feat: prefer WebP display images"`。

### Task 3: 发布包与浏览器验收

**Files:**

- Modify: `scripts/check_publish_bundle.mjs:126-175`
- Modify: `docs/superpowers/specs/2026-07-14-webp-asset-optimization.md`

- [ ] **Step 1: 增加发布包的双格式检查**

在 `scripts/check_publish_bundle.mjs` 添加 `webpSibling(relative)`。该函数仅为 `assets/map/flatmap_votp.png` 与 `assets/buildings/`、`assets/companies/`、`assets/laws/`、`assets/ideologies/` 下的 PNG 返回 `.webp` 同级文件；国旗、利益集团、威望商品、DLC、首页和特质图标返回空。将返回值加入 `requiredFiles`，使发布检查同时验证 WebP 与 PNG；`provinces.png` 仅检查 PNG。

- [ ] **Step 2: 执行完整静态回归**

依次运行 `python scripts/check_webp_asset_conversion.py`、`node scripts/check_webp_image_markup.mjs`、`node scripts/check_publish_bundle.mjs`、`node scripts/check_site_asset_coverage.mjs`、`node scripts/check_law_board.mjs`、`node scripts/check_region_map_interaction.mjs`、`node --check site/app.js` 和 `git diff --check`。预期全部通过且无空白错误。

- [ ] **Step 3: 浏览器验证实际请求**

启动本地静态服务器，打开首页、国家详情、公司详情、法律详情和意识形态详情。确认首页请求 `flatmap_votp.webp`、地图交互仍使用 `provinces.png`，四类详情图片请求 `.webp`，无图片加载失败或控制台错误。使用无 WebP 支持的测试上下文时确认同一位置请求 `.png`。

- [ ] **Step 4: 回填验收结果并提交**

在设计文档写入转换前后字节数、浏览器验证路由与日期，不记录服务器凭据。运行 `git add scripts/check_publish_bundle.mjs docs/superpowers/specs/2026-07-14-webp-asset-optimization.md`，随后运行 `git commit -m "test: verify WebP publication assets"`。
