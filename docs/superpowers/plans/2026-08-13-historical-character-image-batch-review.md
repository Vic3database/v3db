# Historical Character Image Batch Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可持续的 25 人串行复核流程，并完成第一批史实角色图片审核。

**Architecture:** 复核文件结构版本 2 将图片级决定和人物级终态分开保存。采集器只把尚未处理的人物放入 `review`，把人工确认无图或身份歧义的人物放入 `reviewed_without_image`；稳定排序的批次生成器从待复核报告中选择下一批 25 人。

**Tech Stack:** Node.js、JSON、现有维基数据与维基共享资源缓存、原生 JavaScript 浏览器校验。

---

### Task 1: 固化人物级终态契约

**Files:**
- Modify: `scripts/check_historical_character_image_rules.mjs`
- Modify: `scripts/check_historical_character_image_reviews.mjs`
- Modify: `scripts/lib/historical_character_images.mjs`
- Modify: `scripts/data/historical-character-image-reviews.json`

- [ ] **Step 1: Write failing validation assertions**

在规则校验中要求 `validateImageReviewDocument` 接受结构版本 2，并返回 `image_reviews` 与 `person_reviews`。新增艾米·卡迈克尔的 `no_eligible_image` 样本；断言重复人物终态、未排序或重复的维基数据编号、未排序或重复的候选文件名、非法决定以及图片批准与人物无图终态冲突都会抛错。

- [ ] **Step 2: Run tests and verify the version-2 assertion fails**

Run: `node scripts/check_historical_character_image_rules.mjs`

Expected: FAIL，提示结构版本必须为 1 或返回值缺少 `person_reviews`。

- [ ] **Step 3: Implement version-2 validation**

在 `scripts/lib/historical_character_images.mjs` 中增加 `validatePersonReview`、`personReviewKey`、`personReviewForCandidateState`。人物记录必须包含排序且无重复的 `character_keys`、`wikidata_ids`、`candidate_file_titles`，决定只能是 `no_eligible_image` 或 `identity_ambiguous`，并包含合法日期与非空理由。批准图片和人物终态不能绑定同一角色键集合。

- [ ] **Step 4: Upgrade the review document and checks**

把复核文件升级为 `schema_version: 2`，保留十二条图片记录，并为艾米·卡迈克尔增加人物级无合格图片记录。更新文件校验，要求图片记录 12 条、人物记录 1 条，且艾米的两个决定同时存在。

- [ ] **Step 5: Run rule and review checks**

Run: `node scripts/check_historical_character_image_rules.mjs`

Run: `node scripts/check_historical_character_image_reviews.mjs`

Expected: 两项退出码均为 0。

### Task 2: 将已复核未收录人物移出待复核队列

**Files:**
- Modify: `scripts/collect_historical_character_images.mjs`
- Modify: `scripts/check_historical_character_images.mjs`
- Modify: `scripts/check_historical_character_image_data.mjs`

- [ ] **Step 1: Write failing report assertions**

要求报告包含 `reviewed_without_image` 数组；艾米·卡迈克尔只出现在该数组，决定为 `no_eligible_image`，并且不再出现在 `review` 或 `people`。统计必须满足 `reviewed_without_image_people === reviewed_without_image.length`，五个结果集合的角色模板互不重复且总数守恒。

- [ ] **Step 2: Run the report check and verify failure**

Run: `node scripts/check_historical_character_images.mjs`

Expected: FAIL，提示缺少 `reviewed_without_image` 或艾米仍在待复核集合。

- [ ] **Step 3: Implement terminal-state report routing**

采集器读取结构化复核结果。人物匹配有歧义时，用当前全部候选编号和文件名匹配 `identity_ambiguous`；唯一人物没有自动或人工批准图片时，用当前人物编号和文件集合匹配 `no_eligible_image`。精确匹配后写入 `reviewed_without_image`，并标记该人物记录和相关图片拒绝记录已使用；来源集合不一致时抛错。

- [ ] **Step 4: Add report fields and statistics**

报告结构版本升级为 2，增加 `reviewed_without_image`、`reviewed_without_image_people`、`reviewed_no_eligible_image_people` 和 `reviewed_identity_ambiguous_people`。保留 `people` 为前端图片数据唯一来源。

- [ ] **Step 5: Rebuild from cache and verify**

Run: `node scripts/collect_historical_character_images.mjs --request-delay-ms 0`

Run: `node scripts/check_historical_character_images.mjs`

Expected: 确认 401 人、已复核未收录 1 人、待复核 594 人、未匹配 965 人。

### Task 3: 生成稳定的下一批审核清单

**Files:**
- Create: `scripts/build_historical_character_image_review_batch.mjs`
- Create: `scripts/check_historical_character_image_review_batch.mjs`

- [ ] **Step 1: Write a failing batch contract check**

校验脚本运行批次生成器并读取输出，要求默认人数为 25、角色键不重复、全部来自报告 `review`，并按以下优先级稳定排序：精确姓名和出生年且单候选图、精确匹配且多图、保守别名、开局年龄、无图、身份歧义；同级按英文名和角色键排序。

- [ ] **Step 2: Run the batch check and verify failure**

Run: `node scripts/check_historical_character_image_review_batch.mjs`

Expected: FAIL，提示批次生成器不存在。

- [ ] **Step 3: Implement the batch generator**

生成器读取完整报告，支持 `--limit` 和 `--out`，输出结构版本、生成时间、选择规则、人数及完整候选元数据。默认文件为 `output/historical-character-images/review-batch.json`，不下载图片。

- [ ] **Step 4: Run the batch contract check**

Run: `node scripts/check_historical_character_image_review_batch.mjs`

Expected: 输出 `historical character image review batch: ok` 和人数 25。

### Task 4: 完成第一批 25 人审核

**Files:**
- Modify: `scripts/data/historical-character-image-reviews.json`
- Modify: `site/versions/1.13.9/data-character-images.js`
- Modify: `site/versions/1.13.9/data-index.js`
- Modify: `scripts/check_historical_character_image_reviews.mjs`
- Modify: `scripts/check_historical_character_images.mjs`
- Modify: `docs/worklog/2026-08-13-historical-character-images.md`

- [ ] **Step 1: Generate the first batch**

Run: `node scripts/build_historical_character_image_review_batch.mjs --limit 25`

Expected: 输出包含 25 名精确姓名、出生年和单候选图人物的清单。

- [ ] **Step 2: Download and inspect thumbnails serially**

按清单顺序下载候选缩略图，并在相邻网络请求间等待至少 6 秒。制作本地编号审核图，结合人物编号、文件页、作者、日期、许可和画面检查每张图片。单人照片、肖像画或版画写入批准；不合格候选写入拒绝，并为人物写入 `no_eligible_image`。

- [ ] **Step 3: Rebuild and update assertions**

Run: `node scripts/collect_historical_character_images.mjs --request-delay-ms 0`

Run: `node scripts/build_historical_character_image_data.mjs`

根据实际批准与无图人数更新固定样本断言和工作记录，确认这 25 人均已退出 `review`。

- [ ] **Step 4: Run complete related verification**

Run: `node scripts/check_historical_character_image_rules.mjs`

Run: `node scripts/check_historical_character_image_reviews.mjs`

Run: `node scripts/check_historical_character_image_review_batch.mjs`

Run: `node scripts/check_historical_character_images.mjs`

Run: `node scripts/check_historical_character_image_data.mjs`

Run: `node scripts/check_character_board_contract.mjs`

Run: `node scripts/check_data_chunking.mjs`

Run: `node scripts/check_character_board_browser.mjs`

Expected: 所有命令退出码为 0，待复核人数比 594 至少减少 25。

- [ ] **Step 5: Remove temporary review images and commit**

确认 `.tmp` 的解析路径位于当前独立工作树后删除临时审核图，只暂存本计划列出的文件，提交信息使用 `data: review historical character image batch 01`。
