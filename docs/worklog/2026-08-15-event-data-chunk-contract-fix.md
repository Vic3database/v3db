# 2026-08-15 事件数据块契约修复

## 根因

`site/versions/1.13.9/data-events.js` 的事件数据块同时包含 `events` 和事件分组导航使用的 `eventGroups`。`scripts/check_data_chunking.mjs` 还按旧契约只允许 `events`，所以校验在字段检查处失败。

## 修改

将事件数据块契约收紧为明确允许两个字段：`events` 和 `eventGroups`。没有放宽为任意字段，也没有改动事件数据生成器或前端实现。

## 验证

- `node scripts/check_data_chunking.mjs`：通过。
- `git diff --check`：通过。
- `git diff --cached --check`：通过。
- `node scripts/check_goods_needs_browser.mjs`：通过。
- `node scripts/check_event_board_browser.mjs`：通过。

## 状态

本地完成，未提交，未推送，未发布。除本次契约修复与交接记录外，没有触碰其他文件。
