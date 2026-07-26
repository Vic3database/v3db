# 首页公告维护设计

## 目标与范围

Vicdata 首页右侧的公告栏改为从仓库根目录的 `announcements.md` 读取。维护者只编辑这一份 Markdown 文件，每条公告包含日期、标题和正文。发布前的构建会生成浏览器读取的 `site/announcement-data.js`，首页随发布目录一同更新，无需在前端脚本中手动修改公告内容。

本次只处理站内公告。游戏资讯、首页入口、路由、地图和现有部署目录切换流程保持原状。

## 公告源文件与生成结果

新增 `announcements.md`，格式固定为一个一级标题和若干二级标题。二级标题使用 `YYYY-MM-DD｜标题`，标题后的非空内容作为正文。正文可包含多个段落，段落间保留一个空行。

```markdown
# 站内公告

## 2026-07-26｜公告标题

第一段正文。

第二段正文。
```

新增 `scripts/build_announcements_data.mjs`。脚本读取并验证源文件，按日期倒序生成 `site/announcement-data.js`，文件定义 `window.VICDATA_ANNOUNCEMENTS`。每条记录为 `{ date, title, body }`，正文保留段落换行。日期格式、标题和正文缺失时，脚本以包含行号的错误信息退出，不生成部分结果。

`site/index.html` 在应用脚本前加载生成文件。`site/app/boards.js` 使用 `window.VICDATA_ANNOUNCEMENTS` 渲染首页公告，替换当前写死的两条内容。公告按生成顺序全部展示；公告栏设置最大高度和纵向滚动，避免大量历史公告改变首页整体布局。没有公告时显示“暂无公告”。

## 发布与验证

新增 `scripts/check_announcements.mjs`，覆盖有效公告、缺少日期、缺少标题、缺少正文和倒序生成。检查同时验证生成文件存在、首页已加载该文件，并确认首页渲染器使用公告数据。先建立会失败的检查，再实现解析与生成逻辑。

`scripts/check_publish_bundle.mjs` 增加源文件与 `site/announcement-data.js` 一致性校验。发布前必须先运行公告构建脚本，再运行发布检查；源文件修改而生成文件未更新时，发布检查失败。既有服务器端部署脚本继续接收完整的 `site/` 目录，因此目录切换后的首页会读取本次生成的公告数据。

完成后运行 `node scripts/check_announcements.mjs`、`node scripts/check_publish_bundle.mjs`、相关 JavaScript 语法检查和 `git diff --check`。本地启动静态站点后打开 `#/home`，核对公告的日期、标题、段落、排序、空状态与滚动区域。
