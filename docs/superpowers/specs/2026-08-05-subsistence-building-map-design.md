# 自给建筑地图设计

## 目标与入口

在地区板块的资源筛选栏新增一个“自给建筑”入口。点击后切换至专用的合成地图视图，不生成五张单项地图，也不进入资源储量的渐变计算。入口与矿产、其他资源、农业资源筛选并列；同一时刻只保留一个资源或自给建筑视图选择。再次点击入口后恢复现有的战略区域地图。

该视图读取每个地区数据的 `subsistence_building` 字段。当前 1.13.9 数据包含五种值：`building_subsistence_farm`、`building_subsistence_rice_farm`、`building_subsistence_pasture`、`building_subsistence_orchard` 与 `building_subsistence_fishing_village`。地图仍使用既有的地区像素、海域判定、地图缓存、横向环绕、拖动、缩放、单击选中和双击打开地区详情机制。

## 着色、图例与数字

每个陆地地区按自给建筑类别使用固定纯色，不再按数值深浅变化；没有 `subsistence_building` 的陆地地区使用中性灰色。海域继续使用当前海域颜色。五种类别及颜色如下。

| 建筑键 | 图例名称 | 颜色 |
| --- | --- | --- |
| `building_subsistence_farm` | 自给农场 | `#c8893f` |
| `building_subsistence_rice_farm` | 自给水稻农场 | `#4c9f70` |
| `building_subsistence_pasture` | 自给牧场 | `#8b6f47` |
| `building_subsistence_orchard` | 自给果园 | `#b5688b` |
| `building_subsistence_fishing_village` | 自给渔村 | `#4b87b6` |

地图工具栏下方显示始终完整的五项图例，图例顺序与上表一致。地图以地区中心为锚点绘制 `arable_land` 的整数值，用来表示该地区的可耕土地上限；只要地区是陆地且具有数值，`0` 也要绘制。海域、未取得中心坐标的极小地区不绘制数字。数字沿用资源地图的描边、缩放和横向环绕绘制规则，避免与底色混淆。

## 提示框与验证

自给建筑地图的地区提示框保留战略区域、资源、地区特质等既有地区信息，另列出“自给建筑”和“可耕土地”。自给建筑名称使用现有建筑本地化数据，不能直接暴露建筑键。英文界面提供“Subsistence buildings”“Subsistence farm”“Subsistence rice farm”“Subsistence pasture”“Subsistence orchard”“Subsistence fishing village”及“Arable land”对应文本。

增加静态检查，确认五种键与固定颜色的完整映射，入口可切换到专用地图模式，陆地按类别着色，海域与缺失数据不会误用类别色，五项图例完整，标签读取 `arable_land` 并保留 `0`。浏览器检查选择入口后确认图例、五类可见填色和可耕土地数字，悬停确认自给建筑与可耕土地两行，关闭入口后确认恢复战略区域地图；同时确认拖动、缩放、单击和双击没有回归。
