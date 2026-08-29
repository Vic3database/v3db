# 2026-08-29 宗教板块

## 目标

新增宗教板块，重做虔信者相关内容，并同步主版本和 Victorian Century 的宗教数据。

## 完成内容

宗教板块按宗教组和宗教传统展示 17 个宗教，详情包含禁忌商品、相关国家、虔信者风味及特质。虔信者页面改为分组导航，并补充宗教图标与中英文名称。宗教数据抽取加入颜色、宗教传统、国家关联和虔信者风味；犹太教及泛灵论条件风味保留源特质，Victorian Century 的土耳其逊尼派风味保持模组特质。

## 文件

主要修改涉及 `scripts/extract_vic3_countries.mjs`、`scripts/build_wiki.mjs`、`site/app/boards.js`、宗教路由与本地化文件、宗教图标、版本化宗教数据、搜索索引和公告数据。

## 验证

`scripts/check_religion_board.mjs`、`scripts/check_interest_group_board_browser.mjs` 和 `scripts/check_announcements.mjs` 通过；宗教板块在中文和英文界面中完成浏览器验证。

## 状态

主版本和 Victorian Century 宗教数据已重新生成。其他未提交功能未纳入本次提交。
