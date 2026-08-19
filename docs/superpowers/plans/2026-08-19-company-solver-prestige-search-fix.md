# 公司求解器名贵商品检索修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复本地文件模式的名贵商品检索，并让名贵商品约束优先参与公司组合搜索。

**Architecture:** 常规核心继续作为搜索逻辑来源，备用核心保持相同的数据字段和搜索语义。搜索模型先删除与目标建筑无关的公司；深度优先搜索先处理未满足的名贵商品组，再处理未覆盖建筑，并在两类约束上执行可行性和极小性检查。

**Tech Stack:** 原生浏览器 JavaScript、Web Worker、`BigInt`、Node `assert/strict`、Chrome DevTools Protocol。

---

### Task 1：建立失败回归

**Files:**
- Modify: `scripts/check_company_solver_core.mjs`
- Modify: `scripts/check_company_solver_browser.mjs`
- Modify: `scripts/check_victorian_century_company_tools_browser.mjs`

- [ ] 在核心测试加入名贵商品公司、无关公司和两个目标建筑，断言模型剔除无关公司，结果包含名贵商品提供者和补足建筑的公司。
- [ ] 在本地文件浏览器流程加入玻璃厂、波希米亚水晶和公司数 1，断言结果为路德维希·莫泽和泽内玻璃厂。
- [ ] 加入公司数 7 求解为零后切回 1 的流程，断言名贵商品选择保持且结果恢复为一条。
- [ ] 运行测试并确认本地文件用例因备用核心丢失 `possible_prestige_goods` 而失败。

### Task 2：修复核心和备用核心

**Files:**
- Modify: `site/app/company-solver-core.mjs`
- Modify: `site/app/company-solver-core-fallback.js`

- [ ] 让备用核心标准化公司时保留原始字段。
- [ ] 在常规核心建模时删除没有任何目标覆盖状态的公司，并建立名贵商品组的相关公司状态索引。
- [ ] 搜索时先选择候选最少的未满足名贵商品组，候选只允许覆盖目标建筑的公司状态。
- [ ] 在每个节点检查剩余名贵商品候选和剩余建筑覆盖并集；极小性同时检查建筑与名贵商品条件。
- [ ] 将相同搜索语义同步到备用核心，运行核心和本地文件回归并确认通过。

### Task 3：同步输出和验证

**Files:**
- Modify: `site/index.html`
- Modify: `Victorian Century Database/app/company-solver-core-fallback.js`
- Modify: `Victorian Century Database/app/company-solver-core.mjs`
- Modify: `Victorian Century Database/index.html`
- Modify: `site/vc/app/company-solver-core-fallback.js`
- Modify: `site/vc/app/company-solver-core.mjs`
- Modify: `site/vc/index.html`
- Modify: `docs/worklog/2026-08-17-company-industry-combination-solver.md`

- [ ] 更新求解器脚本缓存标识，并通过现有维多利亚世纪构建流程同步两个输出。
- [ ] 运行核心、Worker、合同、原版浏览器、维多利亚世纪公司工具和发布包检查。
- [ ] 运行 `git diff --check`，只记录本次修复涉及的文件和验证结果。

## 计划自检

计划覆盖本地文件故障、名贵商品优先搜索、无关公司剔除、约束完整性、极小性、三份站点输出和浏览器验证。字段名、路径和测试条件与现有求解器实现一致，没有待定项。
