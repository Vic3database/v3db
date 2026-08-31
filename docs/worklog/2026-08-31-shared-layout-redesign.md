# 全站布局与交互统一

## 范围

本轮沿用深蓝、灰黑、暗金和米色配色，统一地图板块与纯内容板块的页面状态、卡片交互和窄屏地图视图。利益集团和宗教保留原有成熟设计。主站位于 `site/`；Victorian Century 的源目录是 `Victorian Century Database/`，`site/vc/` 是构建发布副本。

## 已完成

主站新增地图模式、内容模式、详情打开和窄屏地图全屏状态标记。国家、文化、地域卡片保留主体选择，并提供独立的详情入口；公司改为内容模式，列表页隐藏主地图，卡片主体直接打开详情，详情内部保留已有位置地图。意识形态和法律去除独立详情按钮，点击卡片直接打开详情；事件、日志、决议继续使用卡片直达详情；科技节点继续使用原有详情路由。

窄屏地图增加“全屏”和“收起”按钮。全屏状态隐藏列表、筛选和详情区域，地图占用页面可用区域；收起时恢复板块路由、筛选集合、选中条目、列表滚动位置和地图变换。公司不显示这两个地图状态按钮，桌面端也不显示。共享前端已通过构建脚本同步到 Victorian Century 源目录和 `site/vc` 发布副本。

## 验证

通过：`check_frontend_file_split`、`check_homepage_init_contract`、`check_homepage_layout`、`check_shared_layout_contract`、`check_country_shared_layout`、`check_shared_map_boards`、`check_content_board_interactions`、`check_shared_layout_parity`、`check_victorian_century_standalone_site`、`check_publish_bundle`、`check_victorian_century_main_entry`、`check_technology_board_contract`、`check_ideology_detail_layout`、`check_event_kind_contract`、`check_event_tags_contract`，以及相关 JavaScript 语法检查和 `git diff --check`。

Chrome 调试浏览器检查通过共享布局、国家主体选择/详情入口、窄屏“全屏/收起”、首页工具入口和事件板块。仓库现有 Playwright 国家地图检查未执行，原因是当前环境缺少 `playwright` 模块。

## 提交与发布状态

共享状态和板块交互提交为 `6fdfe281`、`43f54cbb` 和 `ee3bec6d`。设计文档提交为 `482ba9bb`，实施计划提交为 `e78a8a85`。Victorian Century 本地源目录和 `site/vc` 已重新构建并通过一致性检查。本轮尚未推送远端仓库，尚未部署公开站点。

## 未完成

全站仍有部分板块保留历史专用定位规则，后续视觉迭代需要继续以浏览器实测几何为准。国家详情的开局科技、法律等资料扩展不包含在本轮布局改造中。
