# 原版风味内容与国家关联实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为原版 1.13.10 的日志、事件和决议生成主体国家范围及国家反向索引，并接入现有双向跳转界面。

**Architecture:** 原版数据库使用共用分类器生成正向字段和审计文件，原版站点使用独立生成器写入共享内容块。既有事件生成器优先读取统一分类结果，使事件筛选、详情与国家反向索引采用相同口径。

**Tech Stack:** Node.js、ES modules、原生 JavaScript、静态数据块、Node `assert`、Playwright。

---

### Task 1：建立原版数据合同

**Files:**
- Create: `scripts/check_vanilla_content_country_contract.mjs`
- Modify: `scripts/check_versioned_content_builds.mjs`

- [x] **Step 1：写入数据库、站点块和事件块一致性断言**
- [x] **Step 2：运行检查，确认审计文件、共享内容块和生成器缺失**

### Task 2：生成原版数据库关联

**Files:**
- Create: `scripts/build_vanilla_content_country_data.mjs`
- Modify: `database/vic3_1.13.10/journal_entries.json`
- Modify: `database/vic3_1.13.10/events.json`
- Modify: `database/vic3_1.13.10/decisions.json`
- Modify: `database/vic3_1.13.10/content-index.json`
- Create: `database/vic3_1.13.10/content-country-association-audit.json`

- [x] **Step 1：调用共用分类器并回写三类字段**
- [x] **Step 2：生成原版独立审计文件并登记到内容索引**
- [x] **Step 3：运行主体国家单元测试和数据库合同前半段**

### Task 3：生成原版共享内容块

**Files:**
- Create: `scripts/build_vanilla_content_site_data.mjs`
- Modify: `scripts/build_event_site_data.mjs`
- Create: `site/versions/1.13.10/data-content.js`
- Modify: `site/versions/1.13.10/data-events.js`
- Modify: `site/versions/1.13.10/data-index.js`

- [x] **Step 1：让事件站点生成器优先读取统一分类字段**
- [x] **Step 2：筛选游戏定义、补充原版来源和可读组名**
- [x] **Step 3：生成 `contentByCountry` 和 `content` 数据块索引**
- [x] **Step 4：运行原版数据合同和版本构建检查**

### Task 4：验证浏览器交互并记录结果

**Files:**
- Create: `scripts/check_vanilla_country_content_browser.mjs`
- Modify: `docs/worklog/2026-08-16-content-boards.md`
- Modify: `WORKLOG.md`

- [x] **Step 1：验证国家页与日志、事件、决议详情双向跳转**
- [x] **Step 2：验证直接链接、单一滚动区和窄屏无横向溢出**
- [x] **Step 3：运行数据、构建、浏览器及发布合同**
- [x] **Step 4：记录分类数量、审计结果和本地状态**
