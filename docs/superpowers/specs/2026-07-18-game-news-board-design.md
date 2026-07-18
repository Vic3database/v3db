# 游戏资讯板块设计

## 目标与范围

在 Vicdata 首页右侧的“游戏资讯”区域展示已整理的《Victoria 3》公开资讯，并新增独立的“游戏资讯”板块。首页按资讯分类显示最新十条，用户可通过“查看更多 →”进入完整列表。独立板块按分类分页，每页显示二十五条。首轮内容来自 `docs/vic3-资讯链接.md` 已整理的开发日志、版本更新和官方视频，站内不抓取外部页面，也不请求第三方接口。

首页分类固定为“全部”“开发日志”“版本更新”“其他”。“全部”按发布日期倒序合并三类资讯；“开发日志”只显示开发日志；“版本更新”只显示补丁和热修复；“其他”显示官方视频。资讯标题链接到原始页面并以新标签页打开。首页不提供翻页，始终显示所选分类最靠前的十条；独立板块保留当前分类并提供分页控件。

原有公告区、首页资料入口、站外链接、更新日志差异板块和地图行为保持不变。独立资讯板块的哈希路由使用 `#/news`，不加入顶栏主导航，也不占用现有的 `#/changelog`。

## 数据、路由与界面

新增 `site/news-data.js`，以 `window.VIC3_NEWS_DATA` 暴露静态资讯数组。每条记录包含 `id`、`category`、`title`、`date`、`url` 与 `meta`。`category` 使用 `diary`、`patch`、`other` 三个内部值；视频写入 `other`。数据按来源保留标题与日期，页面不翻译或改写原始英文标题。`meta` 用于首页和独立列表显示“开发日志”“版本更新”或“官方视频”等分类文字。

在 `site/app/runtime.js` 中加入资讯数据默认值，以及 `state.newsCategory` 和 `state.newsPage`。在 `site/app/data.js` 的路由识别中将 `news` 作为无需游戏数据块的站内板块；在 `site/app/ui.js` 的 `applyHash()` 中处理 `#/news`，并在 `render()` 中调用 `renderNewsBoard()`。`viewLabels` 添加“游戏资讯”，页面标题随路由变为“游戏资讯 - Vicdata”。从首页进入 `#/news` 时默认保留当前首页分类，并将页码重置为 1；直接访问 `#/news` 时默认显示“全部”。

`site/app/boards.js` 新增纯数据辅助函数：按分类过滤、按日期降序排列、切片首页十条与独立板块二十五条，并将资讯项渲染为链接。`renderHomeBoard()` 的占位内容替换为标签、十行资讯列表与“查看更多 →”按钮。标签点击只更新首页资讯区域；标题链接带有 `target="_blank"` 与 `rel="noreferrer"`；“查看更多 →”写入 `#/news`。`renderNewsBoard()` 使用主结果区显示标题、分类标签、二十五条列表和分页按钮；独立板块不渲染地图、筛选栏或旧详情栏。

样式写入 `site/styles/home.css`，资讯栏沿用首页右侧面板、金色边线、蓝灰色选中标签和当前排版尺度。首页资讯列表限高并显示十行，日期使用较小的辅助文字，标题单行截断。独立板块使用适合宽屏与窄屏的单列资讯行；窄屏时日期移到标题上方，标签横向滚动或等宽缩放，分页按钮保持可点击。新增 `body[data-view="news"]` 的布局规则，使主内容区占用首页以外的可用宽度。

## 验证

新增 `scripts/check_news_board.mjs`，读取分拆后的前端源文件与 `site/news-data.js`，检查开发日志、版本更新和官方视频均已导入，`#/news` 路由存在，首页包含四个分类标签、十条限制和“查看更多 →”，独立板块包含二十五条限制和分页逻辑。检查还应确认所有数据链接为 `https`，每条记录有日期与分类，开发日志、版本更新和官方视频都有至少一条记录。

完成后运行 `node scripts/check_news_board.mjs`、`node scripts/check_homepage_layout.mjs`、`node scripts/check_ui_ideology_contracts.mjs`、`node scripts/check_publish_bundle.mjs`、`node --check site/app/runtime.js`、`node --check site/app/data.js`、`node --check site/app/ui.js`、`node --check site/app/boards.js` 和 `git diff --check`。浏览器核对 `#/home` 的四个标签切换、每类十条上限、外链打开方式和“查看更多 →”；再核对 `#/news` 的分类切换、二十五条上限、上一页与下一页以及窄屏没有横向溢出。
