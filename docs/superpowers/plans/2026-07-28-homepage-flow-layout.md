# 首页自然流式布局实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除桌面端首页入口区与链接区之间由固定底部留白造成的大块空白，并使入口区随可用高度自然伸缩。

**Architecture:** 在 `site/index.html` 中增加只包裹欢迎区、入口区和链接区的 `.home-left-column`。非首页保持 `display: contents`，不改变既有列表页的绝对定位；桌面首页将该容器设为左侧网格，欢迎区与链接区按内容高度排列，入口区占用中间空间并在不足时滚动。右侧公告与资讯栏维持现有独立布局。

**Tech Stack:** HTML、CSS、Node.js 静态布局检查。

---

### Task 1：增加布局回归检查

**Files:**
- Modify: `scripts/check_homepage_layout.mjs`

- [x] **Step 1：加入首页左栏容器与自然流式布局断言**

在既有首页布局断言后加入以下检查，要求 HTML 存在容器，样式不再保留 `top: 285px` 或 `bottom: 300px`，并且桌面首页的入口区是左栏网格中的可滚动中间行：

```js
expect(indexSource.includes('class="home-left-column"'), "homepage should group the welcome, navigation, and links into a left flow column");
expect(/\.home-left-column\s*\{[\s\S]*display:\s*contents/.test(stylesSource), "homepage left flow column should preserve non-home layouts");
expect(/body\[data-view="home"\]\s+\.home-left-column\s*\{[\s\S]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+auto/.test(stylesSource), "desktop homepage should size its left column by welcome, navigation, and links");
expect(/body\[data-view="home"\]\s+\.results\s*\{[\s\S]*position:\s*static[\s\S]*overflow:\s*auto/.test(stylesSource), "homepage navigation should scroll only when its natural middle row is constrained");
expect(!/body\[data-view="home"\]\s+\.results\s*\{[\s\S]*top:\s*285px/.test(stylesSource), "homepage navigation should not use a fixed top offset");
expect(!/body\[data-view="home"\]\s+\.results\s*\{[\s\S]*bottom:\s*300px/.test(stylesSource), "homepage navigation should not reserve a fixed link area");
```

- [x] **Step 2：运行检查并确认失败**

运行：`node scripts/check_homepage_layout.mjs`

预期：检查报告缺少 `.home-left-column` 和自然流式布局规则；原有入口数据、图标和公告断言仍通过。

### Task 2：将桌面首页左侧改为自然流式布局

**Files:**
- Modify: `site/index.html:202-236`
- Modify: `site/styles/home.css:194-238,459-469,805-836`

- [x] **Step 1：在欢迎区、入口区和链接区外加入容器**

将三个相邻区域包入以下容器，保留内部元素和 `id`：

```html
<section class="home-left-column">
  <section id="homeWelcome" class="home-welcome" hidden aria-label="Vicdata 资料库说明">…</section>
  <section class="results">…</section>
  <section id="homeLinks" class="home-links" hidden aria-labelledby="home-links-title">…</section>
</section>
```

- [x] **Step 2：用桌面网格替换固定上下偏移**

保留 `.home-left-column { display: contents; }` 以兼容其他页面；在最小宽度 821 像素的媒体查询中设置：

```css
body[data-view="home"] .home-left-column {
  position: absolute;
  z-index: 3;
  top: 12px;
  right: calc(12px + var(--right-panel-width) + var(--panel-gap));
  bottom: 12px;
  left: 12px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 12px;
}

body[data-view="home"] .home-welcome,
body[data-view="home"] .results,
body[data-view="home"] .home-links {
  position: static;
  inset: auto;
}

body[data-view="home"] .results {
  min-height: 0;
  overflow: auto;
}
```

删除 `.results` 的 `top: 285px` 和 `bottom: 300px`，以及 `.home-welcome`、`.home-links` 的桌面绝对定位坐标。移动端将欢迎区设为普通文档流元素，继续按欢迎区、入口区、链接区的顺序排列。

- [x] **Step 3：运行检查与语法校验**

运行：`node scripts/check_homepage_layout.mjs; node --check site/app/boards.js; git diff --check`

预期：首页布局检查输出 `"homepage_layout": "ok"`，JavaScript 语法检查和空白字符检查均通过。

- [x] **Step 4：提交**

运行：`git add site/index.html site/styles/home.css scripts/check_homepage_layout.mjs docs/superpowers/plans/2026-07-28-homepage-flow-layout.md && git commit -m "fix: let homepage navigation use available height"`

预期：提交仅包含首页流式布局、其回归检查和本实施记录。
