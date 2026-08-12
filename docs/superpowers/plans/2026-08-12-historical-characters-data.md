# 史实角色资料整理实施计划

> **供代理执行：** 必须逐项使用 `superpowers:executing-plans` 或 `superpowers:subagent-driven-development`。每一步完成后勾选复选框。

**目标：** 从原版 Victoria 3 1.13.9 游戏文件提取全部史实角色的可复查资料，暂不处理肖像。

**架构：** 新增独立的 Node.js 提取脚本与静态校验器。脚本读取安装目录中的角色模板、DNA 定义、本地化和开局角色历史，生成被忽略的 JSON 与 Markdown 审计报告；仓库只提交脚本、校验器和设计文档，不提交生成数据或图片。

**技术栈：** Node.js 24、原生文件系统 API、PowerShell、Markdown、JSON。

---

## 文件范围

- 新建：`scripts/audit_historical_characters.mjs`，提取模板、DNA、本地化和开局历史。
- 新建：`scripts/check_historical_characters.mjs`，对真实输出执行统计、字段和代表性人物回归。
- 新建：`docs/superpowers/specs/2026-08-12-historical-characters-data-design.md`，记录口径与边界。
- 新建：`docs/superpowers/plans/2026-08-12-historical-characters-data.md`，记录执行步骤。
- 生成但忽略：`output/historical-characters/historical-characters.json`、`output/historical-characters/historical-characters.md`。

### Task 1：先建立失败校验器

**文件：** 新建 `scripts/check_historical_characters.mjs`。

- [ ] **步骤 1：写入校验器。** 校验器读取 `output/historical-characters/historical-characters.json`，先断言文件存在、`source_game_branch` 为 `release/1.13.9`、角色记录数为 1983、模板键唯一、`invalid_dna_references` 为 0；随后检查五名代表人物的模板键、DNA 键、中文名和 `historical` 标记。

- [ ] **步骤 2：运行确认失败。** 执行 `node scripts/check_historical_characters.mjs`，预期因提取器和输出文件不存在而失败，错误应明确指出缺少 JSON 文件。

### Task 2：实现角色资料提取器

**文件：** 新建 `scripts/audit_historical_characters.mjs`。

- [ ] **步骤 1：实现参数和目录检查。** 支持 `--game-path` 与 `--out`，默认使用 `D:\SteamLibrary\steamapps\common\Victoria 3` 和 `output/historical-characters`；检查 `game`、角色模板、DNA、本地化和角色历史目录。

- [ ] **步骤 2：实现安全的顶层块解析。** 用注释、引号和花括号深度扫描递归读取 `.txt` 文件，提取顶层 `key = { ... }` 块；标量只读直接层级，列表字段读取直接项目。

- [ ] **步骤 3：提取角色字段。** 对 `historical = yes` 块提取 `first_name`、`last_name`、`female`、`birth_date`、`age`、`role`、`culture`、`religion`、`interest_group`、`ideology`、`home_region`、`traits`、`dna`，并从中英文本地化 Map 解析姓名。

- [ ] **步骤 4：关联 DNA 与开局历史。** 收集 `common/dna_data` 的顶层 DNA 键；扫描 `common/history/characters` 中的 `template = ...`，为每个模板写入 `in_starting_history` 和 `starting_history_files`。

- [ ] **步骤 5：生成 JSON 与 Markdown。** JSON 顶层保存来源、分支、生成时间、统计、缺失和无效列表、全部角色；Markdown 按统计、无 DNA、无 DNA 开局角色和全部角色输出摘要表。

### Task 3：让校验通过并复核结果

- [ ] **步骤 1：运行提取器。** 执行 `node scripts/audit_historical_characters.mjs --game-path 'D:\SteamLibrary\steamapps\common\Victoria 3' --out output/historical-characters`。

- [ ] **步骤 2：运行校验器。** 执行 `node scripts/check_historical_characters.mjs`，预期输出 `historical character audit check passed: 1983 records`。

- [ ] **步骤 3：检查代表性数据。** 逐项确认维多利亚女王、俾斯麦、慈禧、明治天皇、林肯的模板、DNA、中文名和 `historical` 字段，另确认 1983 条记录中无效 DNA 引用为 0。

- [ ] **步骤 4：提交源码和文档。** 执行：

```powershell
git add scripts/audit_historical_characters.mjs scripts/check_historical_characters.mjs docs/superpowers/specs/2026-08-12-historical-characters-data-design.md docs/superpowers/plans/2026-08-12-historical-characters-data.md
git commit -m "feat: audit historical character data"
```

- [ ] **步骤 5：提交前验证。** 执行 `git diff --check`、`git status --short --branch`，确认提交不包含 `output/historical-characters/`、`portrait-studio/` 或任何肖像文件。
