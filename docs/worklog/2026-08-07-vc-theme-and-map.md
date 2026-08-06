# 2026-08-07 Victorian Century 配色与地图

Victorian Century 独立站改为深酒红、少量深红紫与低饱和金色的主色。页面底色为纯色 `#161014`，较原底色降低约一成明度；此前用于筛选、科技节点和状态控件的深绿统一为偏冷的灰橄榄 `#2c302f`。页面背景和科技树视图不再使用绿红渐变或绿色光晕。

地图底图由 `flatmap_votp.png` 更换为游戏本体 `flatmap__2.png`，资源保存为 `site/assets/map/flatmap__2.png`，并由 `site/app/runtime.js` 指向。`.gitignore` 只放行这一张受控地图资源，其余地图素材仍保持忽略。独立站构建将其同步至 `site/vc/assets/map/flatmap__2.png`。

首页 2026-08-06 的既有公告补充一句：“为vc适配了新的配色方案和地图以和原版数据库做出区分。”公告数据重新由 `announcements.md` 生成，缓存版本更新为 `20260807-vc-theme1`。

本地发布前检查包括公告解析、发布包、Victorian Century 独立站、配色契约和部署脚本检查；正式服务器发布结果在本次原子切换后补充。
