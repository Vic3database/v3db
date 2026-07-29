# 成就资料提取实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从原版 1.13.9 游戏文件生成完整的 141 项成就资料，保留中文说明、可读提示条件和原始 `possible`、`happened` 脚本。

**Architecture:** 扩展既有 `extract_vic3_countries.mjs` 的 Clausewitz 解析和本地化读取流程，产生独立的 `achievements.json`，并在资料库入口中登记。校验脚本直接读取该文件和游戏图标来源，固定检查成就数量、分组、字段和图标覆盖。

**Tech Stack:** Node.js 内置模块、现有 Clausewitz 解析器、JSON 数据库、Node 严格断言。

---

## 文件结构

- 修改：`scripts/extract_vic3_countries.mjs`。读取九份成就定义、难度分组、中文本地化和图标路径，写出成就数据并更新资料库入口与说明。
- 新增：`scripts/check_achievement_database.mjs`。校验 1.13.9 成就数据和图标源。
- 新增：`database/vic3_1.13.9/achievements.json`。141 项成就的生成结果。
- 修改：`database/vic3_1.13.9/index.json` 与 `database/vic3_1.13.9/README.md`。登记和说明新数据。

### Task 1: 写入成就资料契约校验

**Files:**

- Create: `scripts/check_achievement_database.mjs`
- Read: `scripts/check_technology_database.mjs`
- Read: `database/vic3_1.13.9/index.json`

- [ ] **Step 1: 编写失败的成就资料校验**

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const databaseDir = path.join(root, "database", "vic3_1.13.9");
const index = readJson(path.join(databaseDir, "index.json"));
const gameData = index.source_paths?.game_data;
assert.equal(index.files?.achievements, "achievements.json");
assert.equal(index.counts?.achievements, 141);
assert(gameData && fs.existsSync(gameData), "game data source must exist");
const rows = readJson(path.join(databaseDir, index.files.achievements));
assert.equal(rows.length, 141);
assert.deepEqual(countBy(rows, "group_key"), { easy_group: 31, medium_group: 67, hard_group: 34, very_hard_group: 9 });
const keys = new Set();
for (const row of rows) {
  assert.match(row.id, /^achievement:[A-Za-z0-9_]+$/);
  assert(!keys.has(row.key), `${row.key} occurs more than once`);
  keys.add(row.key);
  for (const key of ["key", "name_zh", "description_zh", "group_key", "group_name_zh", "group_order", "source_file"]) assert(row[key] !== undefined && row[key] !== "", `${row.key} lacks ${key}`);
  assert.match(row.script?.possible || "", /^\{[\s\S]*\}$/);
  assert.match(row.script?.happened || "", /^\{[\s\S]*\}$/);
  assert(Array.isArray(row.details));
  for (const detail of row.details) assert(detail.key && detail.text_zh);
  for (const icon of [row.icon?.achieved, row.icon?.not_achieved]) {
    assert.match(icon || "", /^gfx\/interface\/icons\/achievements\/[^/]+\.jpg$/);
    assert(fs.existsSync(path.join(gameData, icon)), `${row.key} icon must exist in game data`);
  }
}
console.log(JSON.stringify({ achievement_database: "ok", achievements: rows.length }, null, 2));

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); }
function countBy(rows, key) { return rows.reduce((out, row) => ({ ...out, [row[key]]: (out[row[key]] || 0) + 1 }), {}); }
```

- [ ] **Step 2: 运行校验并确认当前状态失败**

Run: `node scripts/check_achievement_database.mjs`

Expected: FAIL，原因是入口尚未声明 `achievements.json`。

- [ ] **Step 3: 提交失败校验基线**

Run: `git add -- scripts/check_achievement_database.mjs; git commit -m "test: define achievement database contract"`

Expected: 新提交只包含校验脚本。

### Task 2: 提取成就、提示条件和原始脚本

**Files:**

- Modify: `scripts/extract_vic3_countries.mjs:135-186`
- Modify: `scripts/extract_vic3_countries.mjs:3644-3729`
- Modify: `scripts/extract_vic3_countries.mjs:3734-3770`
- Create: `database/vic3_1.13.9/achievements.json`
- Modify: `database/vic3_1.13.9/index.json`
- Modify: `database/vic3_1.13.9/README.md`
- Test: `scripts/check_achievement_database.mjs`

- [ ] **Step 1: 在提取主流程中加载成就定义**

在科技数据读取之后加入下列调用，并把 `achievements` 传入 `writeDatabase` 参数和终端统计对象：

```js
const achievements = loadAchievements(
  contentPath("common", "achievements"),
  contentPath("common", "achievement_groups.txt"),
  contentPath("gfx", "interface", "icons", "achievements"),
  loc,
);
```

- [ ] **Step 2: 实现成就提取助手**

在 `loadTechnologyEras` 附近实现 `loadAchievementGroups`、`achievementTooltipDetails`、`achievementIconPath` 和下列主函数。四个函数复用既有 `parseScript`、`asNode`、`firstValue`、`firstScalar`、`stringifyScriptValue`、`locCleanName`、`listFiles` 与 `normalizePath`；分组中出现两次、定义缺失、名称或描述未本地化、`possible` 或 `happened` 缺失、任一图标缺失时抛出含键名的错误。

```js
function loadAchievements(definitionDirs, groupFiles, iconDirs, loc) {
  const groups = loadAchievementGroups(groupFiles, loc);
  const groupByKey = new Map(groups.flatMap((group) => group.achievement_keys.map((key, group_order) => [key, {
    group_key: group.key, group_name_zh: group.name_zh, group_order,
  }])));
  const rows = [];
  for (const file of listFiles(definitionDirs)) {
    const root = parseScript(readText(file), file);
    for (const assignment of root.assignments) {
      const key = scriptEntryKey(assignment.key);
      const node = asNode(assignment.value);
      const group = groupByKey.get(key);
      if (!node || !group) continue;
      const possible = firstValue(node, "possible");
      const happened = firstValue(node, "happened");
      const name_zh = locCleanName(loc, `ACHIEVEMENT_${key}`);
      const description_zh = locCleanName(loc, `ACHIEVEMENT_DESC_${key}`);
      if (!possible || !happened || !name_zh || !description_zh) throw new Error(`成就资料不完整：${key}`);
      rows.push({
        id: `achievement:${key}`, key, name_zh, description_zh, ...group,
        details: achievementTooltipDetails(happened, loc),
        script: { possible: stringifyScriptValue(possible), happened: stringifyScriptValue(happened) },
        icon: {
          achieved: achievementIconPath(iconDirs, `${key}.jpg`, key),
          not_achieved: achievementIconPath(iconDirs, `${key}_notachieved.jpg`, key),
        },
        source_file: normalizePath(file),
      });
    }
  }
  if (rows.length !== groupByKey.size) throw new Error("成就定义与成就分组数量不一致");
  return rows.sort((left, right) => left.group_key.localeCompare(right.group_key) || left.group_order - right.group_order);
}
```

`loadAchievementGroups` 读取 `group = { name = "…" order = { "…" } }` 块，返回 `{ key, name_zh, achievement_keys }`。`achievementTooltipDetails` 只收集 `happened` 内 `custom_tooltip` 的 `text` 键，按首次出现顺序去重，输出 `{ key, text_zh: locCleanName(loc, key) }`。`achievementIconPath` 在覆盖层优先的图标目录中寻找文件，返回相对 `game` 根目录的正斜杠路径；`achievement_placeholder` 不可进入结果。

- [ ] **Step 3: 写入入口、数据文件和说明**

在 `writeDatabase` 的 `files`、`counts` 和写文件阶段加入：

```js
achievements: "achievements.json",
achievements: achievements.length,
writeJson(path.join(dir, "achievements.json"), achievements);
```

在 `writeDatabaseReadme` 的文件列表和数量列表中分别加入：

```js
"- achievements.json：成就主数据，包含难度、中文说明、提示条件、图标引用和原始达成脚本。",
`成就：${index.counts.achievements}`,
```

- [ ] **Step 4: 重建资料库并运行契约校验**

Run:

```powershell
node scripts/extract_vic3_countries.mjs --game-path "D:\SteamLibrary\steamapps\common\Victoria 3" --version 1.13.9 --database database/vic3_1.13.9 --out output
node scripts/check_achievement_database.mjs
```

Expected: 提取成功；`achievements.json` 有 141 项；校验输出 `{ "achievement_database": "ok", "achievements": 141 }`。

- [ ] **Step 5: 提交提取器与生成资料**

Run: `git add -- scripts/extract_vic3_countries.mjs scripts/check_achievement_database.mjs database/vic3_1.13.9/achievements.json database/vic3_1.13.9/index.json database/vic3_1.13.9/README.md; git commit -m "feat: extract achievement database"`

Expected: 新提交不包含既有未跟踪文件。

### Task 3: 交叉核对与回归验证

**Files:**

- Test: `scripts/check_achievement_database.mjs`
- Test: `scripts/check_technology_database.mjs`
- Test: `database/vic3_1.13.9/achievements.json`

- [ ] **Step 1: 核对跨资料片样本**

Run:

```powershell
@'
const fs = require("fs");
const rows = JSON.parse(fs.readFileSync("database/vic3_1.13.9/achievements.json", "utf8").replace(/^\uFEFF/, ""));
for (const key of ["peccavi", "achievement_azadi", "achievement_son_of_varmland"]) {
  const row = rows.find((item) => item.key === key);
  if (!row) throw new Error(`missing ${key}`);
  console.log(JSON.stringify({ key: row.key, name_zh: row.name_zh, group: row.group_name_zh, details: row.details.length, source_file: row.source_file }, null, 2));
}
'@ | node
```

Expected: 三项均有中文名称、难度和来源脚本，来源分别为 `standard_achievments.txt`、`poe_achievements.txt`、`ep2_achievements.txt`。

- [ ] **Step 2: 运行回归检查**

Run: `node scripts/check_achievement_database.mjs; node scripts/check_technology_database.mjs; git diff --check`

Expected: 两项 Node 校验均输出 `ok`；`git diff --check` 无输出且退出码为 0。

- [ ] **Step 3: 确认提交范围**

Run: `git status --short; git log -2 --oneline`

Expected: 两个新提交仅包含成就资料、提取器和校验脚本；既有 `Victorian`、`screenshots/` 和 `scripts/__pycache__/` 未被暂存。
