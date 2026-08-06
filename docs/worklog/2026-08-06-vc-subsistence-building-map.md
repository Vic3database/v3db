# 2026-08-06 Victorian Century 自给建筑地图构建

Victorian Century 数据库已处于最新状态，包含 781 个地区。`data-regions.js` 中有 674 个地区带有自给建筑字段，涵盖自给农场、自给稻田、自给牧场、自给果园和自给渔村；这些地区均具备可耕地上限。其余 107 个地区为海域或没有自给建筑的地区，地图保持空白处理。

通过 `scripts/build_victorian_century_site.mjs` 从当前 `site/` 重建 Victorian Century 独立站，复制应用模块、语言包、样式与资源，并更新 `site/vc/` 生成目录。复用已同步的 VC 资源目录，构建时跳过资源重复同步；经济图标清单仍重新生成。

新增 `scripts/check_victorian_century_subsistence_building_map.mjs`，检查独立站入口、筛选行、农民职业图标、五类渐变、图例、中文“自给稻田”名称和地区数据。地图浏览器检查增加 `--vc` 参数，以相同的交互回归覆盖 `site/vc/index.html`。

验证结果：五类图例位于地图下方，农民职业图标单独成行并紧接农业建筑；五种颜色分别随可耕地上限渐变。`STATE_SOUTHERN_MANCHURIA` 和离屏的 `STATE_PIEDMONT` 经地图点选后，地区列表均正确定位。窄屏宽度为 390 像素时，图例没有造成横向溢出。
