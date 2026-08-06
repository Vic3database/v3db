# 2026-08-07 Victorian Century 配色与地图

Victorian Century 独立站改为深酒红、少量深红紫与低饱和金色的主色。页面底色为纯色 `#161014`，较原底色降低约一成明度；此前用于筛选、科技节点和状态控件的深绿统一为偏冷的灰橄榄 `#2c302f`。页面背景和科技树视图不再使用绿红渐变或绿色光晕。

地图底图由 `flatmap_votp.png` 更换为游戏本体 `flatmap__2.png`，资源保存为 `site/assets/map/flatmap__2.png`，并由 `site/app/runtime.js` 指向。`.gitignore` 只放行这一张受控地图资源，其余地图素材仍保持忽略。独立站构建将其同步至 `site/vc/assets/map/flatmap__2.png`。

首页 2026-08-06 的既有公告补充一句：“为vc适配了新的配色方案和地图以和原版数据库做出区分。”公告数据重新由 `announcements.md` 生成，缓存版本更新为 `20260807-vc-theme1`。

本地发布前通过公告解析、发布包、Victorian Century 独立站、配色契约和部署脚本检查。`site/vc/` 由独立站构建重新生成，发布包共核对 1427 个文件。

2026-08-07 使用 `/home/vicadmin/vicdata-stage-20260807-010932-vc-theme` 作为暂存目录。该目录从当前活动站点建立硬链接副本后，由 `rsync --link-dest=/var/www/vicdata/site` 同步本地 `site/`；预演只列出公告、主题、地图和 Victorian Century 生成副本的变动。服务器脚本在核对公告、主题、主站与 Victorian Century 的地图文件后完成原子切换，活动目录为 `/var/www/vicdata/site`，回退目录为 `/var/www/vicdata/site.previous-20260807-011137`。

公开 `index.html`、公告数据、主站和 Victorian Century 主题样式，以及 `assets/map/flatmap__2.png`、`vc/assets/map/flatmap__2.png` 均返回 HTTP 200；两张地图均为 41,687,615 字节。首页浏览器检查确认公告正文显示指定句子。VC 旧入口浏览器脚本因本机缺少 `playwright` 包未能启动，故未作为本轮浏览器回归依据。
