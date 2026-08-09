# 2026-08-08 利益集团板块

主站新增利益集团板块。顶部“内政”菜单和首页“政治”分类都可进入 `#/interest-group`；页面按固定顺序展示地主、小市民、虔信者、乡村民众、知识分子、实业家、军队、工会八张卡片。卡片只显示游戏图标、官方中文名称、内部键和官方描述，风味内容不在首页重复展示。

`#/interest-group/<基础集团键>` 在主内容区显示独立详情页，包含标准色、基础意识形态、角色意识形态、基础特质和风味变体。变体按内部键去重，并列出适用国家与去重后的触发规则；当前 1.13.9 数据中，地主有 15 个变体，工会没有风味变体，因此工会详情显示明确空状态。

修改范围包括 `site/index.html`、`site/app/runtime.js`、`site/app/data.js`、`site/app/ui.js`、`site/app/boards.js`、双语界面文案和 `site/styles/home.css`。新增 `scripts/check_interest_group_board.mjs` 与 `scripts/check_interest_group_board_browser.mjs`，并更新 `scripts/check_two_level_navigation.mjs` 以覆盖内政菜单中的新入口。资源缓存版本更新为 `20260808-interest-group-board1`。

验证结果：`node scripts/check_interest_group_board.mjs`、`node scripts/check_interest_group_board_browser.mjs`、`node scripts/check_trait_icon_presentation.mjs` 和 `node scripts/check_two_level_navigation.mjs` 通过。浏览器回归使用本机 Chrome 与 1440×1000、390×844 视口：桌面首页为四列八卡，390 像素为两列且页面滚动宽度 380 像素，未出现横向溢出；地主详情显示 15 个变体，工会详情显示空状态。`node scripts/check_ui_ideology_contracts.mjs` 仍在改动前就因公司标签顺序与图标提示文案的三项既有差异失败，未纳入本次修复范围。

后续优化将风味名称并入详情标题，例如“知识分子（公务员、兰学者、民主派、启蒙者、文人）”。特质区固定为 `−5`、`+5`、`+10` 三个认可度位置；同一位置存在风味特质时，以方框切换控件替换卡片内容，并在卡片下方注明适用风味与国家。认可度术语使用游戏本地化中的“不满、满意、忠诚”。详情页返回控件改为 `←`，标题底色与首页卡片统一使用调浅后的群组底色；资源缓存版本更新为 `20260808-interest-group-board6`。

`scripts/extract_vic3_countries.mjs` 现从各利益集团的 `pop_weight` 读取人口吸引力条目，保留职业、任职建筑组、识字率、法律、科技、文化、国家、固定数值与生活水平等计算条件。嵌套分支和 `else` 分支会保留为独立记录，工会劳工的农业任职 `100` 与其余情况 `50` 均已覆盖。新增 `scripts/check_interest_group_pop_attraction.mjs`，并扩展利益集团的静态和浏览器回归，验证知识分子详情中的三槽特质切换与识字率规则。

2026-08-09：详情页返回控件改为图标库的左箭头；风味名称统一以 `/` 分隔。每张风味卡片和风味特质来源中的国家标签按本地化国家名称排序，默认折叠为“查看 N 个国家”。提取器现扫描 `common` 与 `events` 中以 `ig:<基础集团键>` 为作用域的改名效果，连同相关触发条件和特质写入 `potential_flavors`；这会覆盖开局未出现的风味，例如共产主义事件中的“红军”和日本神道决议中的“神道教祠官”。基础名称不会作为风味重复列出。版本资源缓存更新为 `20260809-interest-group-board7`。本轮通过 `node scripts/check_interest_group_board.mjs`、`node scripts/check_interest_group_pop_attraction.mjs`、`node scripts/check_trait_icon_presentation.mjs`、`node scripts/check_two_level_navigation.mjs` 和 `node scripts/check_interest_group_board_browser.mjs`；浏览器回归确认四列桌面、两列窄屏、折叠国家列表、图标箭头、斜杠分隔与两项后续风味。

2026-08-09：特质区改为单一风味选择器。选择“基础”或某一风味后，只显示一组固定的 `−5`、`+5`、`+10` 卡片；风味特质按认可度位置覆盖基础特质，未覆盖的位置保留基础特质。国家列表和匹配规则移至三张卡片上方的风味上下文栏，消除每张卡片内的重复内容。缓存版本更新为 `20260809-interest-group-board8`。浏览器回归确认知识分子默认选择基础，选择“公务员”后会整体替换三槽特质，并同步更新风味上下文。
