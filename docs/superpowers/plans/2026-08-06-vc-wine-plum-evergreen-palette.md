# Victorian Century Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Victorian Century 独立站改为酒红紫、哑金与深绿色主题，同时不改变主站配色和地图数据色。

**Architecture:** 新增仅供 Victorian Century 构建使用的主题覆盖样式表。构建脚本复制该文件并将其放在基础样式表之后加载，使共享的主站样式保持不变。静态检查器锁定颜色令牌与构建接线，生成目录再运行既有独立站和浏览器检查。

**Tech Stack:** 静态 HTML、CSS、Node.js 构建与断言脚本、Chrome 调试协议浏览器检查。

---

### Task 1: 主题回归检查

**Files:**
- Create: `scripts/check_victorian_century_palette.mjs`
- Test: `scripts/check_victorian_century_palette.mjs`

- [ ] **Step 1: 写入失败的检查**

```js
const theme = fs.readFileSync(path.join(root, "site", "victorian-century-theme.css"), "utf8");
assert.match(theme, /--vc-bg:\s*#181216/, "VC theme must define the wine-plum base background");
assert.match(theme, /--vc-evergreen:\s*#1e4b42/, "VC theme must define evergreen as its auxiliary color");
```

- [ ] **Step 2: 运行检查并确认失败**

Run: `node scripts/check_victorian_century_palette.mjs`

Expected: 因为主题文件尚未创建而失败。

- [ ] **Step 3: 保留构建接线断言**

```js
assert.match(builder, /victorian-century-theme\.css/, "VC builder must copy the dedicated theme");
assert.match(builder, /<link rel="stylesheet" href="vc-theme\.css/, "VC builder must load the dedicated theme after the base stylesheet");
```

- [ ] **Step 4: 在实现后重新运行**

Run: `node scripts/check_victorian_century_palette.mjs`

Expected: 输出 `victorian_century_palette: "ok"`。

### Task 2: Victorian Century 专用主题

**Files:**
- Create: `site/victorian-century-theme.css`
- Test: `scripts/check_victorian_century_palette.mjs`

- [ ] **Step 1: 写入最小主题令牌覆盖**

```css
:root {
  --vc-bg: #181216;
  --vc-wine: #542734;
  --vc-plum: #713748;
  --vc-evergreen: #1e4b42;
  --vc-gold: #b89963;
}
```

- [ ] **Step 2: 将共享令牌映射为独立站颜色层级**

```css
:root {
  --bg: var(--vc-bg);
  --surface: #251d22;
  --surface-raised: #34262f;
  --panel: var(--vc-evergreen);
  --accent: var(--vc-gold);
  --accent-blue: var(--vc-evergreen);
}
```

- [ ] **Step 3: 覆盖标题带、当前导航、滚动条和经济板块的旧蓝色与橙色字面量**

```css
.topbar { background: linear-gradient(100deg, var(--vc-evergreen-deep), var(--vc-wine-deep)); }
.topbar-nav-item.active { background: linear-gradient(90deg, var(--vc-evergreen), var(--vc-plum)); }
body[data-view="goods"] .results { background: linear-gradient(135deg, color-mix(in srgb, var(--vc-evergreen) 24%, transparent), transparent 34%), var(--surface); }
```

- [ ] **Step 4: 运行主题检查**

Run: `node scripts/check_victorian_century_palette.mjs`

Expected: 输出 `victorian_century_palette: "ok"`。

### Task 3: 构建接线与生成结果

**Files:**
- Modify: `scripts/build_victorian_century_site.mjs`
- Modify: `scripts/check_victorian_century_standalone_site.mjs`
- Test: `scripts/check_victorian_century_palette.mjs`

- [ ] **Step 1: 复制主题文件**

```js
copyFile(path.join(sourceSite, "victorian-century-theme.css"), path.join(targetSite, "vc-theme.css"), copied);
```

- [ ] **Step 2: 在基础样式表之后载入主题**

```js
.replace(
  '<link rel="stylesheet" href="styles.css?v=20260806-production-goods-flow1">',
  '<link rel="stylesheet" href="styles.css?v=20260806-production-goods-flow1">\n    <link rel="stylesheet" href="vc-theme.css?v=20260806-wine-plum-evergreen1">',
)
```

- [ ] **Step 3: 扩展独立站检查器**

```js
assert(fs.existsSync(path.join(siteRoot, "vc-theme.css")), "missing VC wine-plum-evergreen theme");
assert.match(html, /href="vc-theme\.css\?v=20260806-wine-plum-evergreen1"/, "standalone page must load the VC theme after base styles");
```

- [ ] **Step 4: 在临时目录构建并运行静态检查**

Run: `node scripts/build_victorian_century_site.mjs --target <temporary-vc-directory> --publish-target <temporary-published-directory> --skip-vc-assets`

Expected: 构建输出 `victorian_century_site_build: "ok"`，两个生成目录各有 `vc-theme.css`。

### Task 4: 验证与记录

**Files:**
- Modify: `docs/worklog/2026-08-06-vc-wine-plum-evergreen-palette.md`
- Modify: `WORKLOG.md`

- [ ] **Step 1: 运行静态检查**

Run: `node scripts/check_victorian_century_palette.mjs`、`node scripts/check_victorian_century_standalone_site.mjs`、`node --check scripts/build_victorian_century_site.mjs`、`git diff --check`

Expected: 全部以退出代码 0 结束。

- [ ] **Step 2: 运行本地浏览器检查**

Run: `node scripts/check_victorian_century_browser.mjs --url file:///<temporary-vc-directory>/index.html`

Expected: 现有路由与中英文检查通过，页面根元素计算后的 `--bg`、`--accent`、`--accent-blue` 分别为 `#181216`、`#b89963`、`#1e4b42`。

- [ ] **Step 3: 记录范围和证据**

```markdown
记录主题仅由 Victorian Century 构建加载，主站未加载 `vc-theme.css`；地图数据色未在主题覆盖中重写。
```

- [ ] **Step 4: 提交**

```bash
git add docs/superpowers/specs/2026-08-06-vc-wine-plum-evergreen-palette-design.md docs/superpowers/plans/2026-08-06-vc-wine-plum-evergreen-palette.md scripts/check_victorian_century_palette.mjs site/victorian-century-theme.css scripts/build_victorian_century_site.mjs scripts/check_victorian_century_standalone_site.mjs docs/worklog/2026-08-06-vc-wine-plum-evergreen-palette.md WORKLOG.md
git commit -m "feat: theme Victorian Century in wine plum and evergreen"
```
