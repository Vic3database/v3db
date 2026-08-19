# 移除旧合并内容板块实施计划

**目标：** 保留日志、事件、决议三个独立板块，移除旧“日志、事件、决议”合并板块，并为“星杠旗”增加所指对象说明。

**实现范围：** 数据文件仍以 `content` 数据块承载三个独立板块需要的内容。页面移除旧板块的导航项、筛选结构、渲染脚本和运行时状态；`#/content/journal`、`#/content/event`、`#/content/decision` 继续跳转到独立路由。

**验证方式：** 先增加会在现状下失败的静态契约和本地化契约，再实施最小修改。完成后重建 `Victorian Century Database/` 与 `site/vc/`，运行本地化、独立站、入口和三个板块浏览器检查。

## 任务一：标题说明

- 在 `scripts/check_victorian_century_content_localization.mjs` 中要求 `acw_events.9` 显示“星杠旗（美利坚联盟国国旗）／给我的自由”。
- 在 `scripts/content_localization_overrides.mjs` 中补充对应的资料库显示文本。

## 任务二：删除旧合并板块

- 新建 `scripts/check_legacy_content_board_removed.mjs`，检查 `site/index.html` 中不存在旧导航、板块切换选项、筛选结构和 `app/content.js` 引用，并检查旧渲染脚本已经删除。
- 修改 `site/index.html`、`site/app/runtime.js`、`site/app/data.js`、`site/app/ui.js`、`site/app/boards.js`，移除旧板块界面与状态，保留兼容路由。
- 删除 `site/app/content.js`，并调整 `scripts/build_victorian_century_site.mjs` 与独立站契约。

## 任务三：重建与验证

- 重建合并内容数据和两个 VC 静态站副本。
- 运行本地化、内容变更、内容计数、旧板块移除、独立站、主入口、发布副本及三个独立板块浏览器检查。
- 更新 `docs/worklog/2026-08-16-content-boards.md`，记录显示文本和旧板块移除范围。
