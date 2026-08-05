# 生产方式分组列表 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将建筑详情的生产方式改为游戏式单组列表，使用商品与职业图标，并修正中文职业术语和 Victorian Century 调整标签。

**Architecture:** `site/app/economy.js` 根据当前打开的生产方式组渲染纯图标入口和独立三层列表；组合汇总继续从各组当前选择计算。`scripts/build_economy_assets.mjs` 增加职业图标构建，`scripts/build_wiki.mjs` 与 VC 校验共同排除补丁元数据，避免没有实际数据差异的调整标签。

**Tech Stack:** Node.js ESM、原生浏览器 JavaScript/CSS、Pillow 图标转换、Chrome DevTools Protocol 回归脚本。

---

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `site/app/economy.js` | 生产方式图标条、单组列表、效果分类、组合重算和图标渲染。 |
| `site/styles/economy.css` | 三层生产方式行、选中边框和窄屏布局。 |
| `site/locales/ui.zh-Hans.js` | “教士”及生产方式列表标签。 |
| `scripts/build_economy_assets.mjs` | 构建职业图标并写入经济资源清单。 |
| `scripts/check_economy_assets.mjs` | 校验职业图标清单和文件。 |
| `scripts/check_economy_board_contract.mjs` | 校验生产方式页面契约和中文术语。 |
| `scripts/check_economy_board_browser.mjs` | 校验油井页面的单组展开、三层信息和选择重算。 |
| `scripts/build_wiki.mjs` | 忽略 VC 比较中的 `patch_directives`。 |
| `scripts/check_victorian_century_change_tags.mjs` | 验证比较规则与实际标签一致。 |
| `site/index.html` | 更新样式和应用缓存版本。 |

### Task 1: 先写生产方式列表失败校验

**Files:**

- Modify: `scripts/check_economy_board_contract.mjs`
- Modify: `scripts/check_economy_board_browser.mjs`

- [ ] **Step 1: 在静态契约中加入新列表的必备标记。**

```js
for (const text of [
  "production-method-group-strip",
  "production-method-group-panel",
  "production-method-goods-row",
  "production-method-workforce-row",
  "production-method-extra-row",
  "productionMethodGroupPanelHtml",
  "productionMethodGoodsHtml",
  "productionMethodWorkforceHtml",
]) assert(appSource.includes(text), `missing production-method list contract: ${text}`);

assert(!appSource.includes("selected-production-method-detail"), "legacy production-method details accordion must be removed");
assert(!appSource.includes("board.economy.productionMethodDetails"), "legacy production-method details label must not be rendered");
assert.match(read("site/locales/ui.zh-Hans.js"), /"enum\.popType\.clergymen": "教士"/, "clergymen must use the game Chinese term");
```

- [ ] **Step 2: 在浏览器校验中替换旧的图标选择与折叠框断言。**

```js
const oilRig = await page.evaluate(() => ({
  strip: document.querySelectorAll(".production-method-group-strip [data-production-method-picker]").length,
  openPanels: document.querySelectorAll(".production-method-group-panel:not([hidden])").length,
  legacyDetails: document.querySelector(".selected-production-method-detail"),
}));
assert.equal(oilRig.strip, 2, "oil rig must show one current icon for each production-method group");
assert.equal(oilRig.openPanels, 0, "production-method groups must start collapsed");
assert.equal(oilRig.legacyDetails, null, "legacy production-method accordion must not be rendered");

await page.evaluate(() => document.querySelector("[data-production-method-picker='pmg_base_building_oil_rig']").click());
await page.waitFor(() => document.querySelectorAll(".production-method-group-panel:not([hidden])").length === 1, "base drilling panel");
const basePanel = await page.evaluate(() => ({
  title: document.querySelector(".production-method-group-panel:not([hidden]) > h4")?.textContent?.trim(),
  otherGroups: document.querySelectorAll(".production-method-group-panel:not([hidden]) [data-production-method-group]:not([data-production-method-group='pmg_base_building_oil_rig'])").length,
  goodsRows: document.querySelectorAll(".production-method-group-panel:not([hidden]) .production-method-goods-row").length,
  workforceRows: document.querySelectorAll(".production-method-group-panel:not([hidden]) .production-method-workforce-row").length,
}));
assert(basePanel.title, "opened group must show its group name");
assert.equal(basePanel.otherGroups, 0, "opened group must not mix options from another group");
assert(basePanel.goodsRows > 0 && basePanel.workforceRows > 0, "every listed method must expose goods and workforce rows");
```

- [ ] **Step 3: 运行校验并确认因现有界面缺少新标记而失败。**

Run: `node scripts/check_economy_board_contract.mjs`

Expected: FAIL with `missing production-method list contract`.

- [ ] **Step 4: 提交失败校验。**

```powershell
git add scripts/check_economy_board_contract.mjs scripts/check_economy_board_browser.mjs
git commit -m "test: define production method list contract"
```

### Task 2: 生产方式列表、术语与图标

**Files:**

- Modify: `site/app/economy.js`
- Modify: `site/styles/economy.css`
- Modify: `site/locales/ui.zh-Hans.js`
- Modify: `scripts/build_economy_assets.mjs`
- Modify: `scripts/check_economy_assets.mjs`
- Modify: `site/index.html`

- [ ] **Step 1: 将当前组选择改为纯图标横条与独立组面板。**

```js
function productionMethodGroupStripHtml(groups, selected) {
  return `<div class="production-method-group-strip">${groups.map((group) => {
    const method = selected.get(group.key);
    return method ? `<button class="production-method-current" type="button"
      data-production-method-picker="${escapeHtml(group.key)}"
      data-production-method-key="${escapeHtml(method.key)}"
      aria-expanded="${String(state.openProductionMethodGroup === group.key)}"
      aria-label="${escapeHtml(economyDisplayName(group))}" title="${escapeHtml(economyDisplayName(group))}">
      ${productionMethodIconHtml(method)}</button>` : "";
  }).join("")}</div>`;
}

function productionMethodGroupPanelHtml(group, selectedKey) {
  if (state.openProductionMethodGroup !== group.key) return `<section class="production-method-group-panel" hidden></section>`;
  const methods = group.production_method_keys.map((key) => productionMethodByKey.get(key)).filter(Boolean);
  return `<section class="production-method-group-panel" data-production-method-panel="${escapeHtml(group.key)}">
    <h4>${escapeHtml(economyDisplayName(group))}${victorianCenturyBadge(group)}</h4>
    ${methods.map((method) => productionMethodRowHtml(group, method, method.key === selectedKey)).join("")}
  </section>`;
}
```

- [ ] **Step 2: 按商品、劳动力、第三层附加信息拆分每个生产方式行。**

```js
function productionMethodRowHtml(group, method, selected) {
  const effects = method.effects || [];
  const inputs = effects.filter((effect) => /^goods_input_[a-z0-9_]+_add$/.test(effect.key));
  const outputs = effects.filter((effect) => /^goods_output_[a-z0-9_]+_add$/.test(effect.key));
  const workforce = effects.filter((effect) => /^building_employment_.+_add$/.test(effect.key));
  const extra = effects.filter((effect) => !inputs.includes(effect) && !outputs.includes(effect) && !workforce.includes(effect));
  return `<button class="production-method-row${selected ? " is-selected" : ""}" type="button"
    data-production-method-group="${escapeHtml(group.key)}" data-production-method-key="${escapeHtml(method.key)}">
    <span class="production-method-row-name">${productionMethodIconHtml(method)}<strong>${escapeHtml(economyDisplayName(method))}</strong></span>
    ${productionMethodGoodsHtml(inputs, outputs)}
    ${productionMethodWorkforceHtml(workforce)}
    ${productionMethodExtraHtml(method, extra)}
  </button>`;
}
```

`productionMethodGoodsHtml` 将输入按红色“−”与 `economyAsset("goods", key)` 输出，将产出按绿色“+”与同一图标输出。`productionMethodWorkforceHtml` 用 `assets/pops/<职业键>.webp`、`translateMessage("enum.popType.<职业键>")` 和数值输出。`productionMethodExtraHtml` 先列出科技及可用条件，再分别输出无等级修正和有等级修正；只生成有内容的第三层。

- [ ] **Step 3: 调整事件绑定和样式。**

保留 `state.openProductionMethodGroup`，点击顶端图标切换该组面板。点击同组生产方式只更新 `selectedProductionMethods`，不清空 `openProductionMethodGroup`。删除 `renderSelectedProductionMethodDetail` 调用和 `.selected-production-method-detail` 样式；以 `.production-method-group-strip`、`.production-method-group-panel`、`.production-method-goods-row`、`.production-method-workforce-row` 与 `.production-method-extra-row` 构成三层网格。窄屏时名称、商品、劳动力、附加信息依次换行，页面不产生横向溢出。

- [ ] **Step 4: 扩展职业图标资产构建与术语。**

在 `scripts/build_economy_assets.mjs` 的 `collections` 之后增加固定职业清单，从游戏 `gfx/interface/icons/pops_icons/<key>.dds` 构建到 `assets/pops/<key>.webp`；`check_economy_assets.mjs` 对该固定清单和 `economy-assets.json` 的 `pops` 类别逐项校验。将 `site/locales/ui.zh-Hans.js` 中 `enum.popType.clergymen` 改为“教士”。更新 `site/index.html` 的 `styles.css` 与 `app/economy.js` 缓存版本。

- [ ] **Step 5: 重建图标与中文主站数据。**

Run: `node scripts/build_economy_assets.mjs --database database/vic3_1.13.9 --site site`

Run: `node scripts/build_wiki.mjs --database database/vic3_1.13.9 --out site/versions/1.13.9`

Expected: both commands exit 0 and `site/assets/pops/clergymen.webp` exists.

- [ ] **Step 6: 运行新旧经济校验并提交。**

Run: `node scripts/check_economy_assets.mjs`

Run: `node scripts/check_economy_board_contract.mjs`

Run: `node scripts/check_economy_board_browser.mjs`

Expected: all commands exit 0.

```powershell
git add site/app/economy.js site/styles/economy.css site/locales/ui.zh-Hans.js site/index.html scripts/build_economy_assets.mjs scripts/check_economy_assets.mjs scripts/check_economy_board_contract.mjs scripts/check_economy_board_browser.mjs
git commit -m "feat: present production methods as grouped rows"
```

### Task 3: Victorian Century 标签比较

**Files:**

- Modify: `scripts/build_wiki.mjs`
- Modify: `scripts/check_victorian_century_change_tags.mjs`

- [ ] **Step 1: 写入补丁元数据不应导致调整标签的失败校验。**

```js
const onlyPatchMetadata = { key: "fixture", patch_directives: ["DEFINE"] };
assert.equal(
  stableJson(normalizeForComparison(onlyPatchMetadata)),
  stableJson(normalizeForComparison({ key: "fixture" })),
  "patch directives must not create an adjusted VC tag",
);
```

- [ ] **Step 2: 运行 VC 标签校验并确认失败。**

Run: `node scripts/check_victorian_century_change_tags.mjs`

Expected: FAIL because `patch_directives` remains part of the comparison.

- [ ] **Step 3: 同步构建与校验的忽略字段。**

```js
const victorianCenturyChangeIgnoredFields = new Set([
  "id", "source", "source_file", "source_files", "sourceFile",
  "definition_file", "definitionFile", "patch_directives", "vc_change_kind",
]);
```

在 `scripts/check_victorian_century_change_tags.mjs` 的 `normalizeForComparison` 中加入同一字段，使预期统计和构建结果使用相同规则。

- [ ] **Step 4: 重新构建 Victorian Century 站点并校验标签。**

Run: `node scripts/build_victorian_century_site.mjs`

Run: `node scripts/check_victorian_century_change_tags.mjs`

Run: `node scripts/check_victorian_century_browser.mjs`

Expected: all commands exit 0; no item whose only差异是 `patch_directives` retains an adjusted tag.

- [ ] **Step 5: 提交 VC 标签修正。**

```powershell
git add scripts/build_wiki.mjs scripts/check_victorian_century_change_tags.mjs
git commit -m "fix: ignore patch metadata in VC change tags"
```

### Task 4: 完整回归与工作记录

**Files:**

- Modify: `WORKLOG.md`
- Create: `docs/worklog/2026-08-05-production-method-list.md`

- [ ] **Step 1: 运行完整的相关静态、浏览器和资源校验。**

Run: `node scripts/check_economy_database.mjs`

Run: `node scripts/check_economy_localization.mjs`

Run: `node scripts/check_economy_assets.mjs`

Run: `node scripts/check_economy_board_contract.mjs`

Run: `node scripts/check_economy_board_browser.mjs`

Run: `node scripts/check_victorian_century_change_tags.mjs`

Run: `node scripts/check_victorian_century_browser.mjs`

Expected: every command exits 0.

- [ ] **Step 2: 记录实现范围、生成物与每条校验命令。**

在 `docs/worklog/2026-08-05-production-method-list.md` 记录确认的布局、职业图标类别、术语修正、VC 标签比较变化、重建命令和回归结果；在 `WORKLOG.md` 中更新索引与当前提交。

- [ ] **Step 3: 提交工作记录。**

```powershell
git add WORKLOG.md docs/worklog/2026-08-05-production-method-list.md
git commit -m "docs: record production method list work"
```
