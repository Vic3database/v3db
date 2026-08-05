# 2026-08-05 生产方式分组列表

## 实现范围

建筑详情顶部保留各生产方式组当前选项的图标，图标条不显示组名和选项名。点击图标后只展开对应生产方式组，面板显示组名与组内全部生产方式；当前选择通过金色边框表示，不显示“当前选中”或“当前选择”。选择同组其他生产方式后，面板保持打开，下面的一级建筑组合汇总立即按各组当前选择重新计算。

每项生产方式按三层信息排列。第一层只显示投入和产出商品，以红色“−”和绿色“+”区分，并使用商品图标；第二层只显示职业图标和劳动力数值；第三层在存在内容时依次显示前置科技、可用条件、无等级修正和有等级修正。旧的“生产方式详情”折叠框已经删除。职业图标从游戏 `gfx/interface/icons/pops_icons/` 构建，共 14 类；`clergymen` 的简体中文名称改为“教士”。商品显示直接依据商品键及商品语言包，浏览器回归确认 `wood` 显示为“木材”，`hardwood` 显示为“硬木”，未使用“伍德”或“软木”。

Victorian Century 变更比较不再把 `patch_directives`、来源路径和标签辅助字段算作内容差异。真实调整条目新增 `vc_change_fields`，建筑、商品、生产方式组和生产方式详情会显示可读的调整字段。按新规则，VC 建筑调整由原先 43 项降为 1 项，建筑组由有调整降为 0 项；生产方式组保留 1 项调整，生产方式保留 9 项调整，商品保留 41 项调整，名贵商品保留 13 项调整。

## 构建与验证

重新构建了主站 1.13.9 经济图标与数据索引，并重新生成 Victorian Century 数据和独立站前端。新增职业图标已加入经济资源清单和发布文件检查。以下检查均通过：

- `node scripts/check_economy_database.mjs`
- `node scripts/check_economy_localization.mjs`
- `node scripts/check_economy_assets.mjs`
- `node scripts/check_economy_board_contract.mjs`
- `node scripts/check_economy_board_browser.mjs`
- `node scripts/check_victorian_century_change_tags.mjs`
- `node scripts/check_victorian_century_browser.mjs`
- `node scripts/check_publish_bundle.mjs`

主站 Chrome 回归覆盖油井单组展开、投入产出与劳动力图标、前置科技和修正顺序、选择重算、资源地图入口、`+0.25 木材`显示以及 390 像素窄屏无横向溢出。Victorian Century 回归覆盖建筑和商品图片墙、中英文页面、调整字段说明、联合果品新增生产方式与奔驰名贵商品。
