# 2026-08-06 自给建筑视图修订与地域列表定位恢复

本次修订将中文名称“自给水稻农场”改为“自给稻田”。自给建筑图例只保留五项建筑名称与各自的渐变色块，移除了“自给建筑类型”和“同类建筑中颜色越深，耕地上限越高”。筛选区仍使用自给农职业图标，不显示文字；入口单独成行，紧接农业建筑筛选行之后。

地域地图点选的列表定位来自 `168c22d8 fix: sync region list with map selection`。`18e1e25f perf: update country and region selections locally` 为保留局部选择更新而移除了该滚动。当前在不改变其局部更新路径的前提下，地图点选完成后于下一帧调用 `scrollIntoView({ block: "center", behavior: "smooth" })`，将正常地域卡片居中；若筛选使条目不在普通列表中，既有的临时卡片逻辑不变。地图缩放和拖动变换不会重置。

验证通过：

- `node scripts/check_subsistence_building_map.mjs`
- `node scripts/check_resource_map_colors.mjs`
- `node scripts/check_region_map_interaction.mjs`
- `NODE_PATH=... VC_CHROME_PATH=... node scripts/check_subsistence_building_map_browser.mjs`

浏览器检查确认五项图例文字为“自给农场、自给稻田、自给牧场、自给果园、自给渔村”，自给农图标的筛选行序号为 3，农业建筑行序号为 2。离屏的 `STATE_PIEDMONT` 通过地图点选后，其卡片进入视口中部；781 个地域图形、675 个陆地可耕地数字及五种渐变颜色均保持正确。

## 服务器同步

`main` 的 `7e22ee00` 于 2026-08-06 同步至香港服务器。暂存目录为 `/home/vicadmin/vicdata-stage-20260806-subsistence-map-polish`，以活动站点硬链接副本创建后与本地 `site/` 完整校验一致。`/home/vicadmin/deploy-vicdata.sh` 完成原子切换，活动目录为 `/var/www/vicdata/site`，回退目录为 `/var/www/vicdata/site.previous-20260806-020239`。

切换后，本地与服务器的 `index.html`、地图脚本、地域列表脚本、中文语言包、样式及自给农图标 SHA-256 一致。正式域名对应入口、脚本、语言包、样式和图标均返回 HTTP 200。Chrome 直连 `https://vic3database.org/index.html#/region` 验证自给农图标位于农业建筑下一行，图例为五项建筑名称，加载的地域列表脚本缓存版本为 `20260806-subsistence-polish1`。
