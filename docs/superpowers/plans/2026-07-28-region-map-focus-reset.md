# 地域地图焦点重置实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让地域板块地图工具栏的圆形箭头按钮解除当前地域焦点，并恢复地图初始位置与战略区域配色。

**Architecture:** 复用 `selectedStateRegion` 和 `mapSelectedStateRegion` 两个现有状态字段，不增加新的存储状态。按钮在地域板块调用一个小型重置函数，清空两类焦点、重新渲染，再调用既有 `fitMapToWidth`；其他板块继续直接调用 `fitMapToWidth`。

**Tech Stack:** 原生 JavaScript、Node.js 静态回归检查、浏览器画布地图。

---

### Task 1: 先写地域焦点重置的失败检查

**Files:**
- Modify: `scripts/check_region_map_interaction.mjs:13-14, 65-77`
- Test: `scripts/check_region_map_interaction.mjs`

- [ ] **Step 1: 将重置检查加入主序列**

在现有检查调用后加入：

```js
checkRegionMapFocusColorContracts();
checkRegionMapFocusResetContracts();
```

- [ ] **Step 2: 写入失败断言**

在 `checkRegionMapFocusColorContracts` 后加入：

```js
function checkRegionMapFocusResetContracts() {
  const bindEvents = functionSource("bindEvents");
  const resetRegionMapFocus = functionSource("resetRegionMapFocus");
  const renderMapControls = functionSource("renderMapControls");

  assert(/state\.view === "region"[\s\S]*resetRegionMapFocus\(\)/.test(bindEvents), "region map reset button should clear the region focus");
  assert(/state\.selectedStateRegion = ""/.test(resetRegionMapFocus), "region focus reset should clear the selected state region");
  assert(/state\.mapSelectedStateRegion = ""/.test(resetRegionMapFocus), "region focus reset should clear the temporary map-selected card");
  assert(/render\(\)[\s\S]*fitMapToWidth\(\)/.test(resetRegionMapFocus), "region focus reset should re-render before fitting the map");
  assert(/state\.view === "region" \? "重置地域焦点和地图位置" : "重置地图位置"/.test(renderMapControls), "region map reset button should expose its region-specific label");
}
```

- [ ] **Step 3: 运行检查并确认预期失败**

Run: `node scripts/check_region_map_interaction.mjs`

Expected: 以 `region map reset button should clear the region focus` 失败，因为按钮处理程序尚未区分地域板块。

- [ ] **Step 4: 保留失败测试待同一功能提交**

失败测试不单独提交；与最小实现放入同一功能提交，避免分支留下预期失败的历史状态。

### Task 2: 让圆形箭头恢复地域初始视图

**Files:**
- Modify: `site/app/ui.js:146-148, 203-215`
- Modify: `site/app/map.js:1-15`
- Test: `scripts/check_region_map_interaction.mjs`

- [ ] **Step 1: 为地域板块分派专用按钮行为**

将当前按钮监听器替换为：

```js
  els.mapFitWidthButton?.addEventListener("click", () => {
    if (state.view === "region") {
      resetRegionMapFocus();
      return;
    }
    fitMapToWidth();
  });
```

- [ ] **Step 2: 添加只负责清空地域焦点的函数**

在 `bindEvents` 结束后加入：

```js
function resetRegionMapFocus() {
  state.selectedStateRegion = "";
  state.mapSelectedStateRegion = "";
  render();
  fitMapToWidth();
}
```

该函数不改变路由、筛选、地域列表模式或详情类型。`render()` 恢复完整可见地域集合，随后 `fitMapToWidth()` 恢复初始缩放和位置。

- [ ] **Step 3: 根据板块更新按钮的辅助标签**

在 `renderMapControls` 的开头、早期返回之前加入：

```js
  const mapResetLabel = state.view === "region" ? "重置地域焦点和地图位置" : "重置地图位置";
  els.mapFitWidthButton?.setAttribute("aria-label", mapResetLabel);
  els.mapFitWidthButton?.setAttribute("title", mapResetLabel);
```

保留该函数其余逻辑不变，使其他板块继续显示并执行原有的“重置地图位置”。

- [ ] **Step 4: 运行新增检查并确认通过**

Run: `node scripts/check_region_map_interaction.mjs`

Expected: 输出 JSON，其中 `region_map_interaction` 为 `"ok"`。

- [ ] **Step 5: 运行相关静态检查**

Run: `node --check site/app/ui.js && node --check site/app/map.js && node scripts/check_country_map_selection.mjs && git diff --check`

Expected: 命令均以退出码 `0` 结束；国家地图选择检查仍输出 `country_map_selection: "ok"`。

- [ ] **Step 6: 提交实现和回归检查**

```bash
git add site/app/ui.js site/app/map.js scripts/check_region_map_interaction.mjs
git commit -m "fix: reset selected region map focus"
```

### Task 3: 验证地域与非地域按钮行为

**Files:**
- Verify: `site/app/ui.js`
- Verify: `site/app/map.js`
- Verify: `scripts/check_region_map_interaction.mjs`

- [ ] **Step 1: 验证地域板块的重置流程**

在 `#/region` 中选中一个陆地地域，再单击圆形箭头。确认地址仍为 `#/region`，地域卡片不再带选中状态，地图恢复战略区域配色并回到初始位置。

- [ ] **Step 2: 验证其他板块不解除选择**

在国家或文化板块选中一个项目后单击圆形箭头。确认地图位置被重置，但当前项目仍保持选中，按钮仍显示“重置地图位置”。

- [ ] **Step 3: 验证已有地域交互未回退**

单击地域地图后确认目标地域显示拉普拉塔绿；双击后确认地址进入 `#/state-region/<key>`。运行：`node scripts/check_region_map_interaction.mjs`。预期输出 `region_map_interaction: "ok"`。

- [ ] **Step 4: 记录验证结果**

完成页面验证后，在 `docs/worklog/2026-07-28.md` 记录所用地域键、按钮前后的路由与配色状态，以及静态检查结果；根 `WORKLOG.md` 只保留该记录的索引和当前验证状态。
