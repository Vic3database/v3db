# 2026-08-14 需求表 + 事件板块提交范围整理

## 目标

对已在本地完成但尚未提交的两个功能——商品板块人群需求表（[2026-08-11-goods-needs-tables-integration.md](2026-08-11-goods-needs-tables-integration.md)）和原版事件板块（[2026-08-11-original-content-extraction.md](2026-08-11-original-content-extraction.md)、[2026-08-13-event-board-integration.md](2026-08-13-event-board-integration.md)）——做一次只读的提交范围整理，输出：

1. 本次应纳入同一提交的已修改和未跟踪文件清单；
2. 必须排除的文件清单；
3. 对边界不明确的文件说明原因，交由人工决定。

任务全程不修改、不暂存、不提交、不推送、不部署、不删除任何文件。

## 修改文件

无。本任务全程只读，未修改任何现有文件；本次新增的唯一文件是本工作记录本身（`docs/worklog/2026-08-14-needs-and-event-commit-scope-review.md`）。

## 验证命令及原始结果

读取的交接与工作记录：
- `docs/CLAUDE_HANDOFF.md`
- `docs/worklog/2026-08-11-goods-needs-tables-integration.md`
- `docs/worklog/2026-08-11-original-content-extraction.md`
- `docs/worklog/2026-08-13-event-board-integration.md`

执行的只读 git 命令：

```
git status --short --branch
```
结果：`## main...origin/main`，21 个已修改文件（`M`），43 个未跟踪路径（`??`），其中包含 `Victorian`、`screenshots/`、`pdx-localization.code-workspace`、`scripts/__pycache__/`、`tmp_character_audit.mjs` 等与本轮无关的路径。

```
git diff --name-only
```
结果：21 个已修改文件——`.gitignore`、`scripts/build_wiki.mjs`、`scripts/check_data_chunking.mjs`、`scripts/check_economy_board_contract.mjs`、`scripts/check_victorian_century_standalone_site.mjs`、`scripts/extract_vic3_countries.mjs`、`scripts/site_frontend_sources.mjs`、`site/app/boards.js`、`site/app/components.js`、`site/app/data.js`、`site/app/economy.js`、`site/app/i18n.js`、`site/app/runtime.js`、`site/app/ui.js`、`site/index.html`、`site/locales/manifest.js`、`site/locales/ui.en.js`、`site/locales/ui.zh-Hans.js`、`site/styles.css`、`site/styles/economy.css`、`site/versions/1.13.9/data-index.js`。

```
git diff --stat
```
结果：21 files changed, 442 insertions(+), 28 deletions(-)（逐文件增删行数已核对，最大改动集中在 `site/locales/ui.en.js`/`ui.zh-Hans.js`（各 +96）、`site/index.html`（+48/-4）、`site/app/ui.js`（+49/-4）、`scripts/extract_vic3_countries.mjs`（+56/-20）。

对以上 21 个文件逐一执行 `git diff -- <file>`，确认改动归属：
- 纯需求表：`scripts/build_wiki.mjs`、`check_economy_board_contract.mjs`、`check_victorian_century_standalone_site.mjs`、`extract_vic3_countries.mjs`、`site/app/economy.js`、`site/styles/economy.css`、`site/app/i18n.js`、`site/locales/manifest.js`。
- 纯事件板块：`.gitignore`、`site/app/boards.js`、`site/app/components.js`。
- 两者交织、无法按文件拆分：`scripts/check_data_chunking.mjs`、`scripts/site_frontend_sources.mjs`、`site/app/data.js`、`site/app/runtime.js`、`site/app/ui.js`、`site/index.html`、`site/styles.css`、`site/versions/1.13.9/data-index.js`（单行 JSON，完全无法拆分）、`site/locales/ui.en.js`/`ui.zh-Hans.js`（各自的 `board.needs.*` 与 `board.event.*` 词条位于不同 diff 段，理论上可用 `git add -p` 分段但仍在同一文件内）。

未跟踪文件按前缀/路径归类为需求表专属、事件板块专属、以及与本轮无关三组（详见上一轮报告，未在此重复列出完整路径）。

本任务未运行任何契约检查或浏览器回归——范围内不涉及代码或数据变更，无需重新验证功能正确性。

## 未完成项

1. `docs/superpowers/plans/2026-08-11-*needs*` 与 `docs/superpowers/specs/2026-08-11-*needs*` 系列设计稿是否随本轮需求表提交一起纳入，尚未决定。
2. `docs/CLAUDE_HANDOFF.md` 是跨功能项目交接总览，是否随本次合并提交一起纳入，还是单独处理，尚未决定。
3. 是否需要对交织在同一文件（尤其 `data-index.js`、`styles.css`、`data.js`/`runtime.js`/`ui.js`）的改动做 `git add -p` 级别拆分，取决于是"两个功能一起提交"还是"只发布其中一个"，该决策尚未作出。

## 风险和后续

- **文件级纠缠**：`check_data_chunking.mjs`、`site_frontend_sources.mjs`、`data.js`、`runtime.js`、`ui.js`、`index.html`、`styles.css`、`data-index.js`、`ui.en.js`、`ui.zh-Hans.js` 共 10 个文件中，需求表和事件板块的改动在同一次未提交 diff 里，其中 `data-index.js` 是单行生成的 JSON，两个数据块索引写在同一行，无法通过 diff hunk 拆分，只能重新生成或手工编辑。若日后只想发布其中一个功能，这是唯一的硬性障碍。
- **CRLF 警告**：`git diff`/`git diff --check` 对上述文件持续报 "LF will be replaced by CRLF" 警告，属于 Windows 检出环境的换行符提示，非实际空白冲突（此前 `git diff --check` 已确认 exit=0），不影响提交。
- **交接记录同步**：事件板块前端层的工作记录已在 [2026-08-13-event-board-integration.md](2026-08-13-event-board-integration.md) 补齐；若后续继续修改需求表或事件板块的代码，需要同步更新对应 worklog 与本文件，否则交接记录会与实际代码状态脱节。

## 发布状态

以上工作**仅为本地整理**，未执行任何 `git add`/`git commit`/`git push`/部署操作，公开站点未受影响。是否提交、以何种粒度提交、何时提交，均由后续单独授权决定。
