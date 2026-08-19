# 首页入口、建筑 VC 调整标注与 1.13.10 公告

## 已完成

- 将 `D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/dlc/dlc_vc/thumbnail.png` 的圆形徽章主体保留、四角设为透明后转为 1024×1024 的 `site/assets/home/victorian-century.webp`，首页 Victorian Century 入口改用该图标；随后同步到 `Victorian Century Database/` 和 `site/vc/`。
- 首页游戏内容入口改为日志、事件、决议、成就；日志使用 `event_default.webp`，事件使用 `event_protest.webp`，决议使用 `event_default_option.webp`。顶栏菜单和窄屏板块选择器同步采用相同顺序。
- 建筑差异比较以原版 1.13.10 为基线。除了建筑自身字段差异，还把建筑关联生产方式的效果差异传递为建筑的 `vc_change_kind: "adjusted"`，并用 `production_method_values` 标明字段。
- 当前标注的 8 个建筑为：电子厂、化学合成厂、建造部门、铁路、香蕉种植园、自给稻田、自给果园、自给农场。香蕉种植园的直接差异是生产方式组合数，其余 7 个建筑含生产方式数值差异。
- 公告源保留 2026-08-10，删除更早的四条旧公告，新增 2026-08-17 公告：更新至1.13.10；新增日志、事件、决议板块，优化全局搜索；在商品板块新增人群需求相关内容。
- 游戏资讯数据新增 1.13.10 版本更新条目，发布日期修正为 2026-08-12（瑞典时间 2026-08-11），资讯源说明同步扩展到 1.13.10，并更新数据缓存版本。
- 已同步 `Victorian Century Database/` 和 `site/vc/`。

## 验证

通过首页布局、经济板块契约、公告解析、VC 建筑差异、VC 经济数据库、VC 独立站、主站 VC 入口、发布包和 `git diff --check`。内容板块视觉检查也通过，生成了 `screenshots/content-boards-visual/` 下的主站截图和指标文件。

浏览器经济审计曾发现原版生产方式商品效果实际为 725 条，而旧检查脚本写死 723 条；检查脚本已改为当前页面缓存版本，数据本身未因本次任务修改。

## 服务器同步

1.13.10 游戏资讯发布日期修正为 2026-08-12（瑞典时间 2026-08-11）后，重新生成资讯数据并完成主站、VC 独立站、VC 发布包和 `git diff --check` 检查。发布归档 SHA-256 为 `b467dcacc78d939725a4d82d88e56e7ea9fb2d2a4e1d04c392ef930691205dcb`，服务器校验一致。

服务器暂存目录 `/home/vicadmin/vicdata-stage-20260817-1.13.10-date-vc-icon` 已通过内容校验，随后由部署脚本原子切换。当前回退目录为 `/var/www/vicdata/site.previous-20260817-032032`。公开站点的首页、资讯数据、VC 图标和 VC 首页均返回 HTTP 200；公开资讯数据显示 1.13.10 日期为 2026-08-12。
