# 生产方式组合图标与修正缩放实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将组合摘要改为每级数值加图标，并准确提取、显示无等级、按就业水平和每级三类生产方式修正。

**Architecture:** 数据层在现有生产方式递归收集器中保留 `unscaled` 缩放键，并由数据库检查核对三类效果数量。界面层继续复用现有商品、职业资源路径，新增组合摘要专用图标令牌；生产方式附加信息严格按 `scaling` 分成三组。主站和 Victorian Century 共用同一实现与语言包，通过各自数据库和浏览器检查验证。

**Tech Stack:** Node.js、原生 JavaScript、HTML/CSS、Clausewitz 文本提取器、本地 Chrome 回归脚本。

---

### Task 1: 固定三类缩放效果的数据合同

**Files:**
- Modify: `scripts/check_economy_database.mjs`
- Modify: `scripts/check_victorian_century_economy_database.mjs`
- Test: `scripts/check_economy_database.mjs`
- Test: `scripts/check_victorian_century_economy_database.mjs`

- [ ] **Step 1: 写入失败断言**

在原版检查中统计所有生效生产方式定义的 `scaling`，断言 `workforce_scaled` 为974项、`level_scaled` 为761项、`unscaled` 为182项，并断言 `pm_fertilization` 包含 `state_harvest_condition_drought_impact_mult = 0.05` 的 `unscaled` 效果。Victorian Century 检查使用相同的 `unscaled` 样本，并要求三类缩放方式都存在。

- [ ] **Step 2: 运行检查并确认失败原因**

Run: `node scripts/check_economy_database.mjs`

Expected: FAIL，因为当前数据库的 `unscaled` 数量为0。

Run: `node scripts/check_victorian_century_economy_database.mjs`

Expected: FAIL，因为当前 Victorian Century 数据库同样缺少 `unscaled` 效果。

- [ ] **Step 3: 提交失败合同**

```powershell
git add -- scripts/check_economy_database.mjs scripts/check_victorian_century_economy_database.mjs
git commit -m "test: cover production effect scaling"
```

### Task 2: 补全无等级修正并重建数据库

**Files:**
- Modify: `scripts/extract_vic3_countries.mjs:2410-2425`
- Generate locally: `database/vic3_1.13.9/production_methods.json`
- Generate locally: `database/victorian_century/production_methods.json`
- Test: `scripts/check_economy_database.mjs`
- Test: `scripts/check_victorian_century_economy_database.mjs`

- [ ] **Step 1: 修改递归收集器**

让 `collectProductionMethodEffects()` 将 `unscaled` 与 `workforce_scaled`、`level_scaled` 一样作为缩放容器递归读取，并在效果对象中保留 `scaling: "unscaled"`。

- [ ] **Step 2: 重建原版数据库并验证**

Run:

```powershell
node scripts/extract_vic3_countries.mjs --game-path "D:\SteamLibrary\steamapps\common\Victoria 3" --version 1.13.9 --out output\vic3_1.13.9 --database database\vic3_1.13.9
node scripts/check_economy_database.mjs
```

Expected: PASS，三类效果数量分别为974、761、182。原始文件中的缩放区块可能被同键的后续定义或补丁覆盖，数据库合同只统计最终生效定义。

- [ ] **Step 3: 串行重建 Victorian Century 数据库**

Run:

```powershell
node scripts/check_victorian_century_update.mjs --force --skip-map --skip-network --json
node scripts/check_victorian_century_economy_database.mjs
```

Expected: PASS，Victorian Century 数据中也存在三类缩放方式。

- [ ] **Step 4: 提交提取器和生成数据**

```powershell
git add -- scripts/extract_vic3_countries.mjs
git commit -m "fix: extract unscaled production effects"
```

### Task 3: 固定组合摘要和三类标题的浏览器合同

**Files:**
- Modify: `scripts/check_economy_board_browser.mjs`
- Modify: `scripts/check_economy_board_contract.mjs`
- Modify: `scripts/check_victorian_century_browser.mjs`
- Test: `scripts/check_economy_board_browser.mjs`
- Test: `scripts/check_economy_board_contract.mjs`
- Test: `scripts/check_victorian_century_browser.mjs`

- [ ] **Step 1: 添加组合摘要结构断言**

检查标题为“当前生产方式组合（每级）”；劳动力、投入商品和产出商品行包含正确数量的20像素图标；可见文本只保留数值和分隔符；图标令牌的 `title` 与 `aria-label` 能给出职业或商品名称。继续断言标准产值和修正使用文字。

- [ ] **Step 2: 添加修正分组断言**

使用真实生产方式数据调用页面渲染函数，断言 `unscaled`、`workforce_scaled`、`level_scaled` 分别出现在“无等级修正”“按就业水平修正”“每级修正”下，且“有等级修正”不再出现。英文界面对应显示 `Unscaled modifiers`、`Staffing-scaled modifiers`、`Per-level modifiers`。

- [ ] **Step 3: 运行浏览器与合同检查并确认失败**

Run:

```powershell
node scripts/check_economy_board_contract.mjs
node scripts/check_economy_board_browser.mjs
node scripts/check_victorian_century_browser.mjs
```

Expected: FAIL，因为现有标题仍含“1级建筑”，组合摘要仍显示名称，附加信息仍只有两个错误分组。

- [ ] **Step 4: 提交失败的界面合同**

```powershell
git add -- scripts/check_economy_board_browser.mjs scripts/check_economy_board_contract.mjs scripts/check_victorian_century_browser.mjs
git commit -m "test: define production summary icon layout"
```

### Task 4: 实现组合摘要图标和三类修正分组

**Files:**
- Modify: `site/app/economy.js:285-370`
- Modify: `site/styles/economy.css:80-87`
- Modify: `site/locales/ui.zh-Hans.js:52-98`
- Modify: `site/locales/ui.en.js:52-98`
- Modify: `site/index.html`
- Modify: `site/styles.css`
- Test: `scripts/check_economy_board_contract.mjs`
- Test: `scripts/check_economy_board_browser.mjs`
- Test: `scripts/check_victorian_century_browser.mjs`

- [ ] **Step 1: 严格按三类缩放字段分组**

在 `productionMethodExtraHtml()` 中分别筛选 `unscaled`、`workforce_scaled` 和 `level_scaled`，依次渲染三个标题。保留科技、法律和其他条件的现有顺序。

- [ ] **Step 2: 新增组合摘要图标令牌**

将 `levelOneEmploymentText()` 和 `levelOneGoodsText()` 改为返回安全 HTML。每个令牌按“数值、图标”的顺序输出，令牌带完整 `aria-label`，图标名称写入 `title`；键或数据缺失时回退为现有“数值＋名称”文本。空列表仍返回“无”。

- [ ] **Step 3: 更新标题、语言包和样式**

中文标题改为“当前生产方式组合（每级）”，英文标题改为 `Current production method combination (per level)`，标题不再拼接 `levelOneBuilding`。中文三类标题使用“无等级修正”“按就业水平修正”“每级修正”；英文使用 `Unscaled modifiers`、`Staffing-scaled modifiers`、`Per-level modifiers`。为组合图标令牌添加20像素图标、行内对齐和分隔间距，并更新脚本与样式缓存版本。

- [ ] **Step 4: 运行主站检查**

Run:

```powershell
node --check site/app/economy.js
node scripts/check_economy_board_contract.mjs
node scripts/check_economy_board_browser.mjs
```

Expected: PASS。

- [ ] **Step 5: 重建 Victorian Century 站并验证**

Run:

```powershell
node scripts/build_victorian_century_site.mjs --target "Victorian Century Database" --publish-target site/vc --vc-database database/victorian_century
node scripts/check_victorian_century_browser.mjs
```

Expected: PASS，简体中文与英文均使用新标题和分组。

- [ ] **Step 6: 提交界面实现**

```powershell
git add -- site/app/economy.js site/styles/economy.css site/locales/ui.zh-Hans.js site/locales/ui.en.js site/index.html site/styles.css
git commit -m "feat: use icons in production summaries"
```

### Task 5: 完整回归和工作记录

**Files:**
- Create: `docs/worklog/2026-08-06-production-summary-icons-and-scaling.md`
- Modify: `WORKLOG.md`

- [ ] **Step 1: 运行串行完整检查**

Run:

```powershell
node scripts/check_economy_database.mjs
node scripts/check_victorian_century_economy_database.mjs
node scripts/check_economy_localization.mjs
node scripts/check_economy_assets.mjs
node scripts/check_economy_board_contract.mjs
node scripts/check_economy_board_browser.mjs
node scripts/check_victorian_century_change_tags.mjs
node scripts/check_victorian_century_standalone_site.mjs
node scripts/check_victorian_century_browser.mjs
node scripts/check_publish_bundle.mjs
git diff --check
```

Expected: 全部 PASS。

- [ ] **Step 2: 记录数据口径和验证结果**

工作记录写明三类缩放语义、原版与 Victorian Century 的实际数量、组合摘要图标行为、重建命令和检查结果。根目录 `WORKLOG.md` 仅更新当前状态与详细记录链接。

- [ ] **Step 3: 提交记录**

```powershell
git add -- docs/worklog/2026-08-06-production-summary-icons-and-scaling.md
git commit -m "docs: record production scaling audit"
```
