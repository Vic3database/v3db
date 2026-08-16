# 2026-08-11 原版 1.13.9 日志、事件、决议整理

## 范围

从 `D:/SteamLibrary/steamapps/common/Victoria 3/game` 的 `release/1.13.9` 安装目录提取原版内容，供 Vicdata 后续网页板块使用。日志扫描 `common/journal_entries`，事件递归扫描 `events` 的全部子目录，决议扫描 `common/decisions`，日志组扫描 `common/journal_entry_groups`。英文和简体中文文本递归读取两个本地化目录中的全部对应语言文件。

## 结果

- 日志定义 419 条，游戏内容 418 条，测试内容 1 条；源脚本 172 个。
- 事件定义 2261 条，游戏内容 2236 条，测试内容 1 条，调试内容 24 条；源脚本 331 个，其中 330 个含定义。
- 决议定义 60 条，全部属于游戏内容；源脚本 34 个，其中 33 个含定义。
- 日志组 27 个，事件选项 4836 条。
- 事件英文和简体中文标题各 2204 条、说明各 2147 条、风味文本各 2195 条。

## 输出

`database/vic3_1.13.9/` 下新增 `journal_entries.json`、`journal_entry_groups.json`、`events.json`、`decisions.json`、`content-index.json`、`content-sources.json` 和 `content-stats.md`。每条定义保留脚本键、来源文件、起始行、完整原始脚本块、内容分类和中英文文本；日志、事件、决议还附带网页展示所需的分组、图标、条件、效果、事件图片、选项和事件引用字段。

## 可重复校验

执行 `node scripts/build_content_data.mjs` 可从原版安装目录重新生成。执行 `node scripts/check_content_extraction.mjs` 已通过，校验版本、定义数量、唯一标识符、源文件清单、文本覆盖、日志组、事件类型、选项数量和结构化字段。
