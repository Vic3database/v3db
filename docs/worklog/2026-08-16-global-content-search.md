# 日志、事件与决议全局搜索

## 完成内容

原版 1.13.10、主站 Victorian Century 和独立 Victorian Century 的轻量全局索引已加入日志、事件与决议。默认搜索覆盖中英文标题、内容 ID、所属组 ID 和所属组名称，点击结果进入对应的日志、事件或决议详情。

全局搜索增加“详细搜索”开关。开启后，前端从已加载的内容数据建立会话缓存，增加说明、风味文本、事件选项、条件、效果、来源文件路径和原始脚本匹配；详细字段命中时显示经过 HTML 转义的上下文摘录。关闭开关时这些字段不参与搜索，切换数据集时缓存清空。

静态索引中的原版条目为日志 418、事件 2239、决议 60；两个 VC 输出均为日志 857、事件 2946、决议 102。详细字段没有写入静态索引。

## 验证

`scripts/check_global_content_search.mjs`、`scripts/check_global_content_search_browser.mjs`、`scripts/check_global_search.mjs`、`scripts/check_data_chunking.mjs` 和 `scripts/check_victorian_century_standalone_site.mjs` 均通过。浏览器检查覆盖原版与独立 VC 的默认字段、事件组名称、详细字段隔离、脚本摘录以及三类详情跳转。相关 JavaScript 文件通过 `node --check`，`git diff --check` 状态码为 0。

本轮完成于本地工作区。未提交功能代码，未推送，未公开部署；设计说明提交为 `ce725abe`。

## 结果行高度修正

VC 的“german_unification”查询会返回较多日志与事件，搜索结果容器曾将隐式网格行压缩到 36 像素，而标题和“ID · 所属组”两行文字需要 42.89 像素，文字因此向下溢出 13.89 像素。结果容器现使用按内容计算的网格行并从顶部排列，原版和 VC 的浏览器检查均确认结果文字位于按钮边界内。样式已经同步到主站、`site/vc` 和独立 `Victorian Century Database`，未提交、未推送、未公开部署。
