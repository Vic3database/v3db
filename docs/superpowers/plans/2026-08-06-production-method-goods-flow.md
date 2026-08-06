# 生产方式商品流向显示实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将生产方式列表中的投入与产出分列显示，并用箭头表达商品流向。

**Architecture:** 保留现有生产方式效果与组合计算数据，页面渲染时依据 `goods_input_*` 和 `goods_output_*` 分成两个容器。单项商品的字段决定所在侧，原始数值决定符号，经济效果决定红绿颜色；主站与 Victorian Century 继续共用同一套前端代码。

**Tech Stack:** 原生 JavaScript、CSS、Node.js 断言脚本、Chrome DevTools Protocol 浏览器回归。

---

### Task 1: 用浏览器合同定义商品流向

**Files:**
- Modify: `scripts/check_economy_board_browser.mjs`
- Modify: `scripts/check_victorian_century_browser.mjs`
- Modify: `scripts/check_economy_board_contract.mjs`

- [ ] **Step 1: 添加罐式蒸馏器失败回归**

在主站浏览器检查中打开 `building_food_industry` 的 `pmg_distillery`，读取 `pm_pot_stills` 行的投入容器、箭头和产出容器，并断言以下结构：

```js
assert.deepEqual(potStills.inputs, ["投入：25 糖"]);
assert.equal(potStills.arrow, "→");
assert.deepEqual(potStills.outputs, ["产出：−30 加工食品", "产出：+60 烈酒"]);
```

继续断言正投入为红色、负产出为红色、正产出为绿色，并检查可见文本为 `25→−30+60`，正投入不显示加号。

- [ ] **Step 2: 添加单侧与负投入失败回归**

把果园断言改为只包含产出容器且没有箭头；把工匠缝纫的负投入断言改为 `投入：−15 织物` 且为绿色。使用 `productionMethodGoodsHtml` 构造只有投入与空效果两种情况，确认只有投入时没有箭头，空商品行保持空白。

- [ ] **Step 3: 更新全量商品效果审计**

逐项调用 `productionMethodGoodTokenHtml(effect, direction)`，按以下规则计算预期值：

```js
const raw = Number(effect.value || 0);
const expectedValue = input
  ? `${raw < 0 ? "−" : ""}${formatProductionNumber(Math.abs(raw))}`
  : `${raw < 0 ? "−" : "+"}${formatProductionNumber(Math.abs(raw))}`;
const expectedClass = input
  ? (raw < 0 ? "production-method-good--positive" : "production-method-good--negative")
  : (raw < 0 ? "production-method-good--negative" : "production-method-good--positive");
```

同时检查投入项只进入 `.production-method-goods-inputs`，产出项只进入 `.production-method-goods-outputs`。Victorian Century 使用相同规则审计 725 项商品效果，并加入罐式蒸馏器结构检查。

- [ ] **Step 4: 增加静态合同**

静态合同要求前端包含 `production-method-goods-inputs`、`production-method-goods-arrow`、`production-method-goods-outputs` 和两条商品方向本地化键；缓存版本预期改为 `20260806-production-goods-flow1`。

- [ ] **Step 5: 运行测试并确认预期失败**

Run:

```powershell
node scripts/check_economy_board_contract.mjs
node scripts/check_economy_board_browser.mjs
node scripts/check_victorian_century_browser.mjs
```

Expected: 静态合同因缺少流向容器而失败；主站与 Victorian Century 因罐式蒸馏器仍显示为同一平铺列表而失败。

- [ ] **Step 6: 提交失败测试**

```powershell
git add -- scripts/check_economy_board_contract.mjs scripts/check_economy_board_browser.mjs scripts/check_victorian_century_browser.mjs
git commit -m "test: define production goods flow"
```

### Task 2: 实现投入、箭头与产出布局

**Files:**
- Modify: `site/app/economy.js`
- Modify: `site/styles/economy.css`
- Modify: `site/locales/ui.zh-Hans.js`
- Modify: `site/locales/ui.en.js`
- Modify: `site/index.html`
- Modify: `site/styles.css`

- [ ] **Step 1: 分别渲染投入与产出容器**

将 `productionMethodGoodsHtml` 改为分别排序和渲染两侧。只有两侧都有内容时插入箭头：

```js
function productionMethodGoodsHtml(inputs, outputs) {
  if (!inputs.length && !outputs.length) return '<div class="production-method-goods-row"></div>';
  const inputItems = productionMethodGoodsSideHtml(inputs, "input");
  const outputItems = productionMethodGoodsSideHtml(outputs, "output");
  return `<div class="production-method-goods-row">
    ${inputItems ? `<span class="production-method-goods-side production-method-goods-inputs">${inputItems}</span>` : ""}
    ${inputItems && outputItems ? '<span class="production-method-goods-arrow" aria-hidden="true">→</span>' : ""}
    ${outputItems ? `<span class="production-method-goods-side production-method-goods-outputs">${outputItems}</span>` : ""}
  </div>`;
}
```

- [ ] **Step 2: 实现稳定排序和符号规则**

新增 `productionMethodGoodsSideHtml` 与排序辅助函数。投入侧把非负值排在负值前，产出侧把负值排在非负值前；排序值相同时保留原始定义顺序。`productionMethodGoodTokenHtml` 按原始值生成显示符号：正投入无正号，负投入带负号，所有产出均带正负号。颜色仍按经济效果判断。

- [ ] **Step 3: 补充中英文无障碍文本**

新增 `board.economy.productionGoodInputAria` 和 `board.economy.productionGoodOutputAria`。中文分别为 `投入：{value} {name}` 与 `产出：{value} {name}`，英文分别为 `Input: {value} {name}` 与 `Output: {value} {name}`。商品标记的 `aria-label` 和 `title` 均使用完整方向、数值和名称。

- [ ] **Step 4: 增加流向与窄屏样式**

商品行继续右对齐，两侧容器可内部换行，箭头固定宽度且使用次要文字颜色：

```css
.production-method-goods-side { display: inline-flex; flex-wrap: wrap; justify-content: flex-end; gap: 5px 9px; min-width: 0; }
.production-method-goods-arrow { flex: none; color: var(--muted); font-size: var(--text-lg); line-height: 1; }
```

在 640 像素媒体查询中缩小两侧间距，确保商品较多时各侧可换行，箭头不与图标重叠。

- [ ] **Step 5: 更新前端缓存版本**

把 `site/index.html` 与 `site/styles.css` 中经济页面脚本和样式版本改为 `20260806-production-goods-flow1`。

- [ ] **Step 6: 运行主站绿灯检查**

Run:

```powershell
node --check site/app/economy.js
node scripts/check_economy_board_contract.mjs
node scripts/check_economy_board_browser.mjs
```

Expected: 三项均退出码 0；罐式蒸馏器、果园、负投入、负产出、只有投入和空商品行全部通过。

- [ ] **Step 7: 提交页面实现**

```powershell
git add -- site/app/economy.js site/styles/economy.css site/locales/ui.zh-Hans.js site/locales/ui.en.js site/index.html site/styles.css
git commit -m "feat: separate production inputs and outputs"
```

### Task 3: 同步 Victorian Century 并完成发布门禁

**Files:**
- Generated: `Victorian Century Database/`
- Generated: `site/vc/`
- Create: `docs/worklog/2026-08-06-production-method-goods-flow.md`
- Modify: `WORKLOG.md`（该文件被 Git 忽略，只更新本地索引）

- [ ] **Step 1: 重建 Victorian Century 独立站**

Run:

```powershell
node scripts/build_victorian_century_site.mjs --target "Victorian Century Database" --publish-target site/vc --vc-database database/victorian_century
```

Expected: 构建完成，`site/vc` 使用新的商品流向前端和缓存版本。

- [ ] **Step 2: 串行运行完整验证**

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

Expected: 所有命令退出码 0；主站审计 723 项商品效果，Victorian Century 审计 725 项商品效果，负投入各 8 项，负产出各 21 项。

- [ ] **Step 3: 记录实现与验证结果**

工作记录说明投入侧、箭头和产出侧的符号规则，记录罐式蒸馏器与果园样例、全量审计数量以及实际通过的检查。根 `WORKLOG.md` 更新当前任务和详细记录链接，不纳入提交。

- [ ] **Step 4: 提交工作记录**

```powershell
git add -- docs/worklog/2026-08-06-production-method-goods-flow.md
git commit -m "docs: record production goods flow"
```

- [ ] **Step 5: 提交后复验并确认工作区**

Run:

```powershell
node scripts/check_economy_board_contract.mjs
node scripts/check_economy_board_browser.mjs
node scripts/check_victorian_century_browser.mjs
node scripts/check_publish_bundle.mjs
git status --short --branch
```

Expected: 四项检查退出码 0；本地 `main` 只保留任务开始前已有的未跟踪文件，没有待提交的已跟踪改动。
