# 地域地图焦点配色设计

## 目标

地域板块的地图在没有选中地域时继续按战略区域显示颜色。通过地图单击或右侧地域卡片选中一个陆地地域后，地图将该地域居中显示为拉普拉塔绿 `#00cc66`，其他陆地地域显示为灰色；海域保持既有颜色。单击仍停留在地域板块，双击仍进入地域详情页。

## 范围与实现

现有状态字段 `selectedStateRegion` 继续作为地图和右侧卡片共用的焦点来源，不增加地图模式和状态字段。`regionMapStateRegions` 在 `selectedStateRegion` 指向有效陆地地域时仅返回该地域；没有焦点时继续依据现有筛选、地理区域和战略区域逻辑返回可见地域。地图已有的 `mapFeatureColor` 会把未返回的陆地地域绘为灰色，并保留海域颜色。

地域地图仍使用 `strategicRegion` 模式。`buildStrategicRegionMapFeatures` 检测当前焦点地域，并把对应特征的填充色设为 `#00cc66`；其他可见地域保持原有战略区域颜色。地图图层缓存签名已经包含可见地域集合，选中或切换地域会生成对应图层，无需另加缓存失效路径。

该行为只适用于地域板块中的地域焦点。战略区域、地理区域和资源筛选的既有着色逻辑不变；没有选中地域时，战略区域底图恢复原状。

## 验证

先在 `scripts/check_region_map_interaction.mjs` 写入会失败的断言，要求 `regionMapStateRegions` 在地域焦点存在时只保留该地域，并要求 `buildStrategicRegionMapFeatures` 为焦点地域指定 `#00cc66`。实现后运行该检查、`node --check site/app/map.js`、相关前端检查和 `git diff --check`。

浏览器验证使用一个地图单击和一个右侧地域卡片单击：两种操作都应使目标地域居中并呈拉普拉塔绿，其他陆地灰显，地址仍为 `#/region`；双击仍应进入对应的 `#/state-region/<key>` 详情页。
