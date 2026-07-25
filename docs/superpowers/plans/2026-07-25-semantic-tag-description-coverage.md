# 语义标签说明覆盖实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让公司、地区特质、市场接入度的价格影响、建筑、商品、科技及区域关系标签使用准确的实体类型、说明和操作提示。

**Architecture:** 加载数据时从地域和公司引用建立建筑、商品与地区特质索引，科技复用已有索引。组件为实体标签与关系标签显式传递类型、说明和详情链接；提示框按现有通用布局显示这些元数据。公司 ID 标签移除，控股类别保留独立语义键。

**Tech Stack:** 原生 JavaScript、Node.js 静态契约、现有版本化数据块。

---

### Task 1: 建立索引和失败契约

**Files:**
- Modify: `scripts/check_tag_tooltip_contracts.mjs`
- Create: `scripts/check_semantic_tag_coverage.mjs`
- Modify: `site/app/runtime.js`, `site/app/data.js`

- [ ] 为地区特质、建筑、商品和科技的提示元数据写入失败契约。
- [ ] 确认契约在当前实现中失败。
- [ ] 在数据加载后建立去重索引，保留原始引用中的中文名与效果字段。

### Task 2: 接入实体和效果标签

**Files:**
- Modify: `site/app/components.js`, `site/app/ui.js`, `site/app/tag-tooltip-definitions.js`, `site/app/presentation.js`

- [ ] 移除公司列表与详情标题中的公司 ID 标签。
- [ ] 地区特质标签使用 `stateTrait`，说明优先显示效果汇总；类别、普通效果和市场接入度的价格影响使用独立语义键。
- [ ] 建筑、商品和科技标签使用实体类型；科技标签可进入科技详情页。
- [ ] 公司与地区特质字段中的科技改为实体标签。

### Task 3: 接入区域关系说明并回归

**Files:**
- Modify: `site/app/components.js`, `site/index.html`, `scripts/check_tag_tooltip_contracts.mjs`

- [ ] 为战略区域的开局国家、本土文化，以及地理区域的战略区域和地域数量传入关系说明。
- [ ] 更新缓存参数。
- [ ] 运行语法检查、数据检查、标签契约、右侧详情、意识形态和前端拆分检查；不启动浏览器。
