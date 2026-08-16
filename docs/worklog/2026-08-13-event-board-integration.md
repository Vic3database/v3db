# 2026-08-13 事件板块集成

## 原始数据提取范围与数量

数据来源与 [2026-08-11-original-content-extraction.md](2026-08-11-original-content-extraction.md) 一致，均取自 `D:/SteamLibrary/steamapps/common/Victoria 3/game` 的 `release/1.13.9` 安装目录，由 `scripts/build_content_data.mjs` 提取到 `database/vic3_1.13.9/`：

- 日志（journal_entries）419 条，游戏内容 418 条，测试内容 1 条；源脚本 172 个。
- 事件（events）2261 条，游戏内容 **2236** 条，测试内容 1 条，调试内容 24 条；源脚本 331 个（330 个含定义）。事件板块只展示游戏内容的 2236 条事件。
- 决议（decisions）60 条，全部为游戏内容；源脚本 34 个（33 个含定义）。
- 日志组 27 个，事件选项总数 **4836** 条。
- 事件英文和简体中文标题各 2204 条、说明各 2147 条、风味文本各 2195 条。

## 事件板块分类与本地化

由 `scripts/build_event_site_data.mjs` 在原始提取结果之上生成站点数据块 `site/versions/1.13.9/data-events.js`：

- **通用/风味分类**：`scripts/event_kind.mjs` 依据事件命名空间、触发条件与作用域推断分类，2236 个游戏事件中通用 **1400** 条、风味 **836** 条，二者相加等于事件总数。
- **事件标签**：`scripts/event_tags.mjs` 定义 11 类标签（legislation、journal、character、politics、war-diplomacy、economy-production、technology、society-culture、disaster-disease、country-territory、election），每类标签至少命中 1 个事件，一个事件可同时具备多个标签。
- **分组名称**：`scripts/event_group_names.mjs` 为全部 **352** 个事件命名空间提供中英文分组名称，未在人工维护清单中的命名空间会从事件键前缀派生兼容名称（如"无政府主义"）。
- **效果修饰符本地化**：`scripts/event_effects.mjs` 解析事件选项引用的 static_modifier，只使用游戏官方本地化文本（`modifiers_l_*.yml`），未获得官方译名的修饰符不做翻译发明，缺口记录在 [docs/audits/1.13.9-event-modifier-localization-gaps.md](../audits/1.13.9-event-modifier-localization-gaps.md)。

## 页面功能

`site/app/events.js` 与 `site/styles/events.css` 实现事件板块前端：

- **分组导航**：按命名空间分组展示事件，导航项使用上述 352 个分组名称，点击可滚动定位到对应分组。
- **标签筛选**：11 个标签筛选按钮，支持与事件类型（通用/风味）筛选组合使用，可重置。
- **搜索**：按标题、说明、命名空间等文本搜索，保留匹配结果所在分组。
- **详情面板**：点击事件卡片展示完整详情，包含来源脚本路径（如 `events/1848.txt:5`）、触发/立即执行脚本、选项列表及每个选项对应的效果修饰符展开。
- **事件选项**：列表卡片展示选项数量与文本，详情面板中每个选项独立编号并可展开脚本与效果说明。
- **中英文**：`site/versions/1.13.9/locale-events.zh-Hans.js` 与 `locale-events.en.js` 分别提供简体中文和英文文本，界面词条集中在 `board.event.*`。
- **窄屏适配**：宽度 ≤1100px 时详情面板改为块级布局并占满可用宽度，与筛选区域切换显示，避免遮挡。

## 已执行并通过的检查

均在启动本地站点服务（`node scripts/serve_site.mjs site 4173`，确认 `http://127.0.0.1:4173/index.html` 返回 200）后执行：

- `node scripts/build_content_data.mjs` — 通过，重新生成原始内容数据库。
- `node scripts/check_content_extraction.mjs` — 通过。
- `node scripts/check_event_kind_contract.mjs` — 通过（通用 1400 / 风味 836）。
- `node scripts/check_event_tags_contract.mjs` — 通过（11 类标签均有命中）。
- `node scripts/check_event_effects_contract.mjs` — 通过（效果修饰符本地化规则校验）。
- `node scripts/check_event_group_names_contract.mjs` — 通过（352 个命名空间分组名称）。
- `node scripts/check_event_board_browser.mjs` — 通过（CDP 浏览器回归，含分组导航、标签筛选、搜索、详情面板、窄屏布局校验，实际耗时约 6.5 秒）。

## 发布状态

以上工作**目前仅为本地实现完成**，尚未执行任何 `git add`/`git commit`/`git push`/部署操作，公开站点未发布本次改动。是否提交、何时提交由后续单独授权决定。
