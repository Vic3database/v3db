# 2026-08-05：Victorian Century 与英文经济内容

本次补全了主站 1.13.9 与 Victorian Century 的建筑、商品经济数据链路。Clausewitz 定义补丁合并器可处理 `DEFINE`、`INJECT`、`TRY_INJECT`、`REPLACE`、`REPLACE_OR_CREATE` 和 `CREATE`，提取器会按模组补丁后的最终定义生成建筑、建筑组、生产方式组、生产方式、商品和名贵商品，并保留来源文件与补丁指令。Victoria 3 原版数据为 101 个建筑、53 种商品、72 种名贵商品、197 个生产方式组和 436 种生产方式；Victorian Century 数据为 101 个建筑、53 种商品、98 种名贵商品、197 个生产方式组和 437 种生产方式。

中英文经济本地化已覆盖建筑、生产方式、商品和名贵商品引用。英文数据不含中文字符、游戏脚本占位符或概念标记。Victorian Century 对马丘比丘、Basmati Rice、Ironclad Tools 等别名使用实际显示名称。经济图片构建会优先读取模组图标，缺失时回退原版，并在 `site/assets/economy-assets.json` 中记录类别、对象键、来源类型、相对来源与输出路径。原版生成 101 个建筑图标、53 个商品图标、72 个名贵商品图标和 435 个生产方式图标；Victorian Century 独立站生成对应的 101、53、98、436 个图标。

Victorian Century 建筑与商品图片墙增加了“VC新增”“VC调整”筛选按钮。筛选状态为空时显示全部条目，选择后只显示对应来源标签的条目。卡片、建筑详情、生产方式组、生产方式详情和名贵商品详情会显示新增或调整标签。维多利亚世纪数据中，43 个建筑、41 种商品、1 个生产方式组、12 个生产方式和 13 个名贵商品为调整项，另有 1 个生产方式和 26 个名贵商品为新增项。

独立站发布检查覆盖 10 个数据块、简体中文与英语本地化文件和 14 个前端模块；`--skip-map` 强制更新会重建数据、图标和独立站，但保留地图文件并在更新状态中记录 `map_rebuilt: false`。工作树执行 `node scripts/check_victorian_century_update.mjs --force --skip-map --skip-network --json` 后，随后 `--check-only --skip-network --json` 返回 `up_to_date`。

已通过 Clausewitz 补丁、经济数据库、本地化、图标、变更标签、数据分块、发布包与独立站静态检查。浏览器检查使用 Chrome 调试协议，已验证主站 1.13.9 中文和英文建筑、商品详情，以及 Victorian Century 建筑、商品图片墙、变更筛选、施工部门的调整生产方式、香蕉种植园的新增生产方式和汽车中的 Benz Automobiles 名贵商品。通用多语言浏览器脚本因本地未安装 `playwright` 未执行；本次涉及的页面由不依赖该包的经济回归脚本覆盖。
