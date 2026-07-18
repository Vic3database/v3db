# 公司详情地图尺寸与颜色实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将公司详情小地图缩至 300 像素宽，并将关联州地区统一显示为拉普拉塔绿色。

**Architecture:** CSS 将详情概览右列限制为 300 像素，地图仍以 4:3 比例随窄屏收缩。地图特征构建不再使用每州所属战略区域颜色，而是以固定 `#00cc66` 填充公司关联州地区；未关联州地区保留淡化底图色。

**Tech Stack:** 原生 JavaScript、CSS、Node.js 断言脚本。

---

### Task 1: 锁定视觉回归条件

**Files:**
- Modify: `scripts/check_company_detail_location_map.mjs:91-95`

- [ ] **Step 1: 写入失败断言**

```js
assert.match(styles, /\.company-detail-overview\.has-location-map\s*{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*300px\)/, "company detail map column must cap at 300 pixels");
assert.match(app, /const\s+COMPANY_LOCATION_MAP_COLOR\s*=\s*"#00cc66"/, "company location map must use La Plata green");
```

- [ ] **Step 2: 运行断言并确认失败**

Run: `node scripts/check_company_detail_location_map.mjs`

Expected: FAIL，地图列仍为比例列且固定颜色常量尚不存在。

### Task 2: 实现缩小地图与固定标注色

**Files:**
- Modify: `site/styles/records.css:1187-1208`
- Modify: `site/app/map.js:295-307,493-495`

- [ ] **Step 1: 限制详情地图列宽**

```css
.company-detail-overview.has-location-map {
  grid-template-columns: minmax(0, 1fr) minmax(0, 300px);
}
```

- [ ] **Step 2: 使用固定拉普拉塔绿绘制关联州地区**

```js
const COMPANY_LOCATION_MAP_COLOR = "#00cc66";

function companyAssociationColor(count) {
  return count > 0 ? COMPANY_LOCATION_MAP_COLOR : "#f5f1e8";
}
```

- [ ] **Step 3: 运行地图检查**

Run: `node scripts/check_company_detail_location_map.mjs`

Expected: PASS。

### Task 3: 进行渲染核验

**Files:**
- Verify: `site/app/map.js`
- Verify: `site/styles/records.css`

- [ ] **Step 1: 在本地预览打开马志沃德公司详情**

Run: 使用浏览器打开 `#/company/company_a_markwald_and_company`，读取地图宽高、地图像素颜色和主地图显示状态。

Expected: 地图宽 300 像素、高 225 像素，标注州地区为 `#00cc66`，公司主地图仍隐藏。

- [ ] **Step 2: 运行相关回归检查**

Run: `node scripts/check_company_detail_location_map.mjs; node scripts/check_ui_ideology_contracts.mjs; node scripts/check_right_panel_layout.mjs; node scripts/check_publish_bundle.mjs; git diff --check`

Expected: 所有命令退出码为 0。

- [ ] **Step 3: 提交变更**

```bash
git add docs/superpowers/plans/2026-07-18-company-location-map-scale-color.md scripts/check_company_detail_location_map.mjs site/app/map.js site/styles/records.css
git commit -m "style: compact company location maps"
```
