# Historical Character Image Review Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可审计的史实角色图片人工复核层，并让爱因斯坦的 1921 年照片进入确认数据和角色界面。

**Architecture:** 版本化复核文件只保存人工决定，纯函数负责结构校验和候选解析，采集器负责检查所有复核记录均被当前数据使用。完整采集报告继续驱动前端数据构建，界面无需增加新的数据源。

**Tech Stack:** Node.js、JSON、现有维基数据与维基共享资源缓存、原生 JavaScript 浏览器校验。

---

### Task 1: 固化复核规则

**Files:**
- Modify: `scripts/check_historical_character_image_rules.mjs`
- Create: `scripts/check_historical_character_image_reviews.mjs`

- [x] **Step 1: Write failing unit assertions**

在规则校验中导入 `validateImageReviewDocument` 和 `selectReviewedImage`。用无类型的爱因斯坦候选断言：精确批准记录返回该候选并把类型设为 `photograph`；批准群像时抛错；拒绝记录使候选退出自动选择。

- [x] **Step 2: Write the review-file contract check**

新校验读取 `scripts/data/historical-character-image-reviews.json`，要求结构版本为 1，第一条批准记录的角色键为 `albert_einstein_template`、人物编号为 `Q937`、文件名为 `File:Einstein 1921 by F Schmutzer - restoration.jpg`、类型为 `photograph`。

- [x] **Step 3: Run tests and confirm failure**

Run: `node scripts/check_historical_character_image_rules.mjs`

Expected: FAIL，提示缺少复核函数导出。

Run: `node scripts/check_historical_character_image_reviews.mjs`

Expected: FAIL，提示复核文件不存在。

### Task 2: 实现复核层

**Files:**
- Create: `scripts/data/historical-character-image-reviews.json`
- Modify: `scripts/lib/historical_character_images.mjs`
- Modify: `scripts/collect_historical_character_images.mjs`

- [x] **Step 1: Add the Einstein review record**

创建结构版本 1 的复核文件，批准施穆策 1921 年照片，记录 `photograph`、`2026-08-13` 和选择理由。

- [x] **Step 2: Implement validation and reviewed selection**

`validateImageReviewDocument` 校验决定、角色键、人物编号、文件名、日期和批准类型；`selectReviewedImage` 精确匹配角色键集合与人物编号，拒绝记录先过滤候选，批准记录还必须通过排除原因、人物证据和许可检查。

- [x] **Step 3: Integrate reviews into report generation**

采集器支持 `--reviews` 参数，默认读取版本化复核文件。报告为每个确认人物写入 `confirmation_method`；人工批准记录附带复核摘要，统计中增加自动确认和人工确认人数。构建结束时存在未使用复核记录即失败。

- [x] **Step 4: Run rule and review checks**

Run: `node scripts/check_historical_character_image_rules.mjs`

Run: `node scripts/check_historical_character_image_reviews.mjs`

Expected: 两项校验退出码为 0。

### Task 3: 重建数据并验证界面

**Files:**
- Modify: `site/versions/1.13.9/data-character-images.js`
- Modify: `site/versions/1.13.9/data-index.js`
- Modify: `scripts/check_historical_character_images.mjs`
- Modify: `scripts/check_historical_character_image_data.mjs`
- Modify: `scripts/check_character_board_browser.mjs`
- Modify: `docs/worklog/2026-08-13-historical-character-images.md`

- [x] **Step 1: Rebuild the cached report and site data**

Run: `node scripts/collect_historical_character_images.mjs --request-delay-ms 0`

Run: `node scripts/build_historical_character_image_data.mjs`

Expected: 首批复核完成后确认 401 人、404 个模板，待复核 595 人，未匹配 965 人。

- [x] **Step 2: Add report, data, and browser assertions**

报告及前端数据校验要求爱因斯坦使用指定文件、类型为照片且确认方式为人工复核。浏览器校验搜索或打开 `albert_einstein_template`，检查列表标签和详情图片文件链接。

- [x] **Step 3: Run full related verification**

Run: `node scripts/check_historical_character_images.mjs`

Run: `node scripts/check_historical_character_image_data.mjs`

Run: `node scripts/check_character_board_contract.mjs`

Run: `node scripts/check_character_board_browser.mjs`

Expected: 所有校验退出码为 0。

- [x] **Step 4: Update worklog and commit selected files**

记录人工复核层、爱因斯坦样本和最新统计，只暂存本阶段文件，提交信息使用 `feat: add historical image review layer`。
