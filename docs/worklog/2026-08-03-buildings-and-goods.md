# 2026-08-03：建筑与商品板块

主站 1.13.9 新增“建筑”和“商品”两个独立板块，数据来自 `D:\SteamLibrary\steamapps\common\Victoria 3\game`。建筑墙固定显示农业、资源、工业、军事、基建、所有权建筑和奇观七个大组，不显示组内小标题。原始建筑组继续保留在资料中，并派生展示大组、组内簇和排序值，供后续英文与 Victorian Century 套用同一框架。农业按主粮农场、畜牧场、葡萄园、种植园、自给建筑排列；资源按五种矿井、金矿场、伐木营地、橡胶种植园、油井、渔业码头、捕鲸站排列。武器厂、弹药厂和火炮铸造厂归入工业，造船厂归入轻工业。建筑墙收录 101 个具有原始图标的建筑；14 个 `bg_monuments_hidden` 图形定义没有图标，记录在数据库排除清单中，不生成卡片。商品墙收录 53 种基础商品，详情仅列出可生产建筑；72 种名贵商品作为对应基础商品的详情变体显示。

建筑详情按生产方式组横向排列图标。选中生产方式后显示前置科技、可用条件和修正；每个建筑同时列出所有生产方式组合，并把同一组合中的无条件修正按作用域、缩放方式和修正键合并，带条件的修正单独标明。油井提供两项基础生产方式和三项自动化生产方式，共六种组合。农业与资源建筑会自动选中相应资源筛选器，跳转至 `#/region/resource/<building-key>`；资源类型由地区数据判定，小麦农场使用可耕地资源，油井使用上限资源。

新增 `data-buildings.js` 和 `data-goods.js` 两个按需加载数据块，以及 101 个建筑、53 个商品、72 个名贵商品和 378 个有原始图标的生产方式 WebP 文件。`scripts/check_publish_bundle.mjs` 现在从数据块枚举这些资源，发布检查共验证 1,321 个文件。

本次验证依次执行了 `node scripts/check_economy_database.mjs`、`node scripts/check_economy_assets.mjs`、`node scripts/check_economy_board_contract.mjs`、`node scripts/check_publish_bundle.mjs`、`node scripts/check_economy_board_browser.mjs http://127.0.0.1:8896/index.html` 和 `node scripts/check_achievement_board_browser.mjs http://127.0.0.1:8896/index.html`。浏览器检查确认建筑墙 101 项及七个大组、农业卡片顺序、油井 2×3 生产方式与资源地图跳转、商品墙 53 项、石油生产建筑链接和巴库名贵商品显示。
