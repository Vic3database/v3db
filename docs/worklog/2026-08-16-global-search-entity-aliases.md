# 全局搜索实体别名

## 完成内容

原版 1.13.10、`site/vc` 和独立 `Victorian Century Database` 的全局搜索已经接入正式名称变体与内部兼容别名。国家名称来自 `dynamicNameVariants`，地区名称来自 `stateRegions[].dynamic_name_variants`，公司类型名称来自 `companies[].dynamic_company_type_names`，建筑兼容 ID 来自 `common/buildings` 定义中的 `aliases`。

索引继续以 `names` 保存基础名称；玩家可见的正式名称变体按语言写入 `aliases`，建筑脚本兼容 ID 写入不参与标题显示的 `internalAliases`。同一实体只生成一条搜索结果。基础名称命中时显示基础名称；当前语言正式别名命中时显示实际命中的别名，并以基础名称作为副信息；内部兼容别名命中时仍显示基础名称。

原版索引含国家别名条目 144 个、地区别名条目 164 个、公司别名条目 25 个、建筑内部别名条目 19 个。两个 Victorian Century 输出均含国家别名条目 155 个、地区别名条目 164 个、公司别名条目 25 个、建筑内部别名条目 19 个。原版与 Victorian Century 数据库各保留 19 条建筑兼容别名。

重建内容索引后，原版仍含日志 418 条、事件 2239 条、决议 60 项；两个 Victorian Century 输出仍含日志 857 条、事件 2946 条、决议 102 项。内容追加过程保留了基础实体的 `aliases` 与 `internalAliases`。

## 验证

以下命令均以状态码 0 完成：`node scripts/check_economy_database.mjs vic3_1.13.10`、`node scripts/check_search_alias_unit.mjs`、`node scripts/check_global_search_aliases.mjs`、`node scripts/check_global_search.mjs`、`node scripts/check_global_content_search.mjs`、`node scripts/check_global_content_search_browser.mjs`、`node scripts/check_data_chunking.mjs` 和 `node scripts/check_victorian_century_standalone_site.mjs`。

浏览器检查覆盖原版与 Victorian Century 页面。查询“清”同时命中 `CHI` 与 `CMI`，其中 `CHI` 显示“大清”；查询“中国”仍显示基础名称；“埃尔萨斯‑洛林根”“财团”和 `building_barracks` 分别命中对应地区、公司和建筑。每个样本实体只出现一行，建筑兼容 ID 不作为标题显示。详细搜索字段隔离、结果行高度和日志、事件、决议详情导航也通过回归检查。

主站、`site/vc` 和独立站点的 `boards.js` 哈希均为 `FA0B0E24AA365A883D3B0DB359E2A61EBFA2C8E946883FC4CC23853988006048`，`presentation.js` 哈希均为 `B5610606DDF66F9421FB7AC3BCCFC964D4AB647DC6AE2C2BEE7767AA722759DA`。

本轮工作位于 `codex/global-search-entity-aliases` 分支。实现提交为 `634c7a9f`、`b9b4826f`、`abf6a5e1`、`77c8b7d8` 和 `026006a1`。当前只在本地完成，尚未推送，也未部署到公开站点。
