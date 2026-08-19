# Victorian Century 日志、事件、决议合并

## 范围

将 Victoria 3 1.13.9 原版与 Victorian Century Workshop 模组的日志、日志组、事件和决议合并到 `database/victorian_century`。同 ID 定义由 VC 覆盖原版，记录 `sources` 和 `source_files` 以保留来源证据。

## 结果

- 日志：856 条，其中 VC 独有 437 条。
- 日志组：27 个，当前仅原版定义。
- 事件：2946 条，其中 VC 独有 682 条；26 个 ID 同时有原版与 VC 定义，使用 VC 版本。
- 决议：102 条，其中 VC 独有 42 条。
- 事件选项：6137 个。

## 命令

```powershell
node scripts/build_victorian_century_content.mjs
node scripts/check_victorian_century_content_contract.mjs
```

## 产物

- `database/victorian_century/journal_entries.json`
- `database/victorian_century/journal_entry_groups.json`
- `database/victorian_century/events.json`
- `database/victorian_century/decisions.json`
- `database/victorian_century/content-index.json`
- `database/victorian_century/content-sources.json`
## 独立站内容板接入

已将合并后的日志、事件、决议数据接入 `Victorian Century Database/` 和发布副本 `site/vc/`。新增 `data-content.js` 数据块及内容板脚本，支持日志、事件、决议三类切换、基础游戏与维多利亚世纪来源筛选、搜索和详情路由。详情页保留本地化标题、选项、来源文件、原始脚本和来源标记；事件选项按独立区块显示。

当前内容统计为日志 856 条、事件 2,946 条、决议 102 条，事件选项 6,137 条。内容数据仍由 `database/victorian_century/` 作为单一输入源生成，主站在没有内容数据块时隐藏该入口，避免把维多利亚世纪内容混入原版 1.13.9 页面。

验证：`check_victorian_century_content_contract.mjs`、`check_victorian_century_standalone_site.mjs`、`check_victorian_century_content_browser.mjs`、`check_victorian_century_main_entry.mjs`、`check_event_board_browser.mjs` 和 `check_victorian_century_browser.mjs http://127.0.0.1:8877/index.html building goods` 均通过；相关脚本通过 `node --check`，目标文件通过 `git diff --check`。
