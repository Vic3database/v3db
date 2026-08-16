# 2026-08-14 商品需求页响应式布局修复

## 背景

已暂存的 pop-needs-table + event-board 提交（137 个文件）在实际浏览时暴露出两个前端回归问题，涉及主站 `site/`、`site/vc/` 与独立站 `Victorian Century Database/` 三份同步副本：

1. 约 826px 宽的竖屏窗口下，商品需求页（`#/goods/needs/...`）标题栏下方出现大片空白。
2. Victorian Century 财富等级需求量表中，金色生活水平分段竖线与实际列边界错位。

修复要求：不提交、不推送、不停止本地 4173 服务器；仅暂存实际修改的文件与本文档，其余 137 个已暂存文件保持原状。

## 根因排查

### Bug 1：826px 竖屏空白

`site/styles/shell.css` 的 `@media (max-aspect-ratio: 3 / 2)`（宽高比断点，仅取决于视口形状，高/宽 > 1.5 即触发，与绝对宽度无关）中，`.layout { padding-top: 56vh; }` 为隐藏的地图面板预留了空间，商品/建筑视图原本没有被排除在外。

而 `site/styles/economy.css` 中已有的 `@media (max-width: 699px) { body[data-view="building"] .layout, body[data-view="goods"] .layout { padding-top: 0; } }` 是**宽度断点**，826px 宽度不会触发它。

两个断点的判定条件不同——一个基于宽高比、一个基于绝对宽度——导致 826px 宽、竖屏形状的窗口正好落入“预留空间生效但没有任何规则清零”的空隙区间。这就是空白区域的根因。

### Bug 2：分段竖线错位

`site/app/needs.js` 中原先的竖线定位完全基于固定像素公式 `left = NEEDS_WEALTH_PROJECT_WIDTH + (level - 1) * NEEDS_WEALTH_COLUMN_WIDTH`，与真实渲染的表头单元格位置是两套独立计算、没有相互校验的逻辑。多组视口宽度、缩放比例（1x/1.25x/1.5x/2x）、开启/关闭 VC 对比模式、横向滚动前后的实测显示，固定公式在这些场景下已经十分接近（约 0.016px 级别的渲染误差），但这套“重复计算、互不校验”的架构本身仍然脆弱：一旦列宽、粘性列内边距、多语言文案宽度或缩放比例发生变化，两套逻辑随时可能产生可见的错位，且难以在代码层面察觉。

## 修复方案

### Bug 1 修复

在 `site/styles/shell.css` 里，**扩展已经存在于宽高比断点内的排除选择器列表**（此前只排除 `ideology`/`law` 视图），加入 `building`/`goods` 视图：

```diff
   body[data-view="ideology"] .layout,
-  body[data-view="law"] .layout {
+  body[data-view="law"] .layout,
+  body[data-view="building"] .layout,
+  body[data-view="goods"] .layout {
     padding-top: 0;
   }
```

选择在 shell.css 的宽高比断点内直接扩展排除列表，而不是放宽 economy.css 里的宽度断点阈值，原因是：56vh 的地图预留空间本身就是在这个宽高比断点里声明的，修复应该和根因同处一处；扩大宽度阈值有更大概率影响其他未知宽度下的其他视图。此改动不影响同一媒体查询块内针对国家/文化等仍显示地图页面的其他选择器组（那是完全独立的移动端工具栏样式，选择器不同）。

### Bug 2 修复

在 `site/app/needs.js` 中让竖线定位变为“自校正”：为灰色分隔线的 `<span>` 与财富等级表头 `<th class="needs-wealth-head-level">` 都补充 `data-level` 属性（金色分段线 `.needs-tier-divider` 原本已有该属性），然后新增 `alignNeedsWealthDividers(stage, table)` 函数，在渲染与每次尺寸变化（`ResizeObserver`）时，直接读取对应表头单元格的 `getBoundingClientRect().left`，把这个真实测量值写回竖线的 `style.left`，取代原来的固定像素公式：

```javascript
function alignNeedsWealthDividers(stage, table) {
  const stageLeft = stage.getBoundingClientRect().left;
  stage.querySelectorAll(".needs-wealth-line-layer > span[data-level], .needs-tier-divider[data-level]").forEach((line) => {
    const headCell = table.querySelector(`.needs-wealth-head-level[data-level="${line.dataset.level}"]`);
    if (!headCell) return;
    line.style.left = `${headCell.getBoundingClientRect().left - stageLeft}px`;
  });
}
```

`bindNeedsWealthLineLayers` 的 `sync()` 闭包在每次同步表格尺寸时都会调用它，因此横向滚动、窗口缩放、语言切换等任何导致列宽变化的场景都会重新对齐，不再依赖两套互相独立的坐标计算。

## 三份站点同步

`site/app/needs.js` 与 `site/styles/shell.css` 的改动已同步到 `site/vc/` 与 `Victorian Century Database/` 对应文件，三份副本再次逐字节比对一致。

（注：`site/vc/` 与 `Victorian Century Database/` 均已被 `.gitignore` 忽略，不作为 git 可暂存对象，本次仅同步磁盘内容，不涉及 git 暂存。）

## 回归检查扩展

`scripts/check_goods_needs_browser.mjs` 新增两项检查：

- `checkNarrowPortraitBlankSpace`：以 826×1200 竖屏视口分别打开主站与 VC 的商品需求页，断言结果列表顶部与顶栏底部之间没有出现异常大的空白（`resultsTop <= topbarBottom + 24`）。
- `checkWealthDividerAlignment`：分别对主站财富等级需求量表与 VC 财富等级需求量表，测量每条分隔线（灰色与金色）与其对应表头列边界的像素差，要求横向滚动前后偏差都不超过 1px。

## 验证结果

以下命令均在不停止本地 4173 服务器的前提下执行：

- `node scripts/check_pop_needs_database.mjs database/vic3_1.13.9 vanilla` → `{"pop_needs_database":"ok","mode":"vanilla","needs":15,"relations":52,"wealth_levels":99}`，EXIT=0
- `node scripts/check_pop_needs_database.mjs database/victorian_century vc` → `{"pop_needs_database":"ok","mode":"vc","needs":15,"relations":53,"wealth_levels":99}`，EXIT=0
- `node scripts/check_goods_needs_contract.mjs` → `{"goods_needs_contract":"ok","checks":["all"]}`，EXIT=0
- `node scripts/check_goods_needs_browser.mjs`（针对 `http://127.0.0.1:4173/index.html` 与 `http://127.0.0.1:4173/vc/index.html`）→ `{"goods_needs_browser":"ok","verified":["substitutes","wealth","locales","vc-comparison","narrow-scroll","portrait-826-blank-space","wealth-divider-alignment"]}`，EXIT=0
- `git diff --check` （针对修改文件）→ 无冲突标记，仅有基准 CRLF 提示，EXIT=0

## 实际修改文件清单

- `site/app/needs.js`（新增 `data-level` 属性、新增 `alignNeedsWealthDividers` 函数）
- `site/styles/shell.css`（扩展 `padding-top: 0` 排除选择器列表）
- `site/vc/app/needs.js`、`site/vc/styles/shell.css`（同步，未纳入 git 暂存，因该目录被 `.gitignore` 忽略）
- `Victorian Century Database/app/needs.js`、`Victorian Century Database/styles/shell.css`（同步，未纳入 git 暂存，同上）
- `scripts/check_goods_needs_browser.mjs`（新增两项回归检查）
- 本文档 `docs/worklog/2026-08-14-needs-responsive-layout-fix.md`

## 暂存状态

仅将上述实际修改的 git 可追踪文件（`site/app/needs.js`、`site/styles/shell.css`、`scripts/check_goods_needs_browser.mjs`）与本文档加入暂存区，此前已暂存的 137 个文件未被触碰、未重新暂存、未取消暂存。未执行 `git commit`，未推送，未部署。
