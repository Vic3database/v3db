# 2026-08-02：省份地形图

## 完成内容

地域板块筛选栏新增“地形视图”。开启后，地图按省份显示十种陆地地形：平原、森林、丘陵、山地、丛林、湿地、沙漠、苔原、稀树草原、极地。海洋和湖泊保留纸质底图，不显示图例、提示或地域选择。

资源、战略区域和地理区域筛选继续决定哪些地域保持地形色；未命中的陆地用既有淡灰色处理。右侧地域列表保持原有内容。地图底部显示可换行图例。悬停陆地省份显示 `x` 加六位大写十六进制代码、地形、所属地域和战略区域；单击选中所属地域，双击打开其详情。

## 数据与构建

数据来自 `D:\SteamLibrary\steamapps\common\Victoria 3\game\map_data\province_terrains.txt`。该文件有 40,875 条颜色映射，包含 10 种陆地地形、`ocean` 和 `lakes`。构建脚本写入 12 个源键与 354,085 组地形游程数据；原有地域游程和开局所有权游程逐项比对未变化。

省份代码没有在地图数据中重复存储。页面在悬停时从既有 `provinces.png` 采样一个像素，保留 `x57EBCB` 这种原始格式。

## 验证

主站和 Victorian Century 都通过 `scripts/check_province_terrain_map_browser.mjs`：十项图例可见，陆地提示字段完整，水体无提示且无法选中，单击和详情路由正常，资源筛选下仍保持地形模式和地域列表。390×844 视口下图例宽 344 像素，`scrollWidth` 与 `clientWidth` 相同。

静态检查通过：`check_province_terrain_map.mjs`、`check_region_map_interaction.mjs`、`check_map_state_centers.mjs`、`check_resource_map_colors.mjs`、`check_achievement_board_contract.mjs`、`check_publish_bundle.mjs`、各相关脚本语法检查和 `git diff --check`。
