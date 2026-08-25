# 文化板块整合时长计算器

## 目标

在文化板块提供按国家预载、按文化标签自由组合的整合时长计算器，取代国家详情路径直接进入情景地图的功能，同时保留国家板块基础整合年数地图。

## 已完成修改

新增 `#/culture/incorporation` 和 `#/culture/incorporation/<TAG>` 路由。进入奥地利时默认选中南德意志文化，并从已审计的联邦方案路径加载匈牙利、捷克、斯洛伐克、克罗地亚、塞尔维亚、斯洛文尼亚、波兰、罗马尼亚、乌克兰、北意大利和塞克利文化候选。用户可以搜索、添加、删除文化；空集合显示空状态。新增独立 `cultureIncorporation` 地图模式和地域结果列表，复用 2、5、10、15、25 年计算规则。

移除了旧的国家路径情景按钮、情景运行时状态、情景地图上下文和情景专用浏览器脚本。国家板块的基础整合年数按钮仍保留，继续使用国家默认主流文化。主站、Victorian Century 独立站和 `site/vc` 已同步计算器前端。

## 未解决问题

计算器展示的是用户选择文化后的静态规则结果，不模拟游戏时间推进、速度修正、法律效果或实际条件满足状态。顶栏缓存检查仍有既有基线问题时，单独记录，不修改无关缓存链。

## 涉及文件

- `site/app/culture-incorporation.js`
- `site/app/runtime.js`
- `site/app/ui.js`
- `site/app/boards.js`
- `site/app/presentation.js`
- `site/app/map.js`
- `site/index.html`
- `site/styles/records.css`
- `site/locales/ui.zh-Hans.js`
- `site/locales/ui.en.js`
- `scripts/check_culture_incorporation_calculator_contract.mjs`
- `scripts/check_culture_incorporation_calculator_browser.mjs`
- `Victorian Century Database/` 和 `site/vc/` 当前工作树检查副本

## 测试结果

文化计算器契约、国家基础整合年数契约、主流文化数据契约、多语言契约和 JavaScript 语法检查均通过。主站、Victorian Century 独立站和 `site/vc` 浏览器检查均通过，覆盖奥地利默认文化、加入匈牙利/捷克/斯洛伐克、删除文化、清空状态、法国和阿富汗国家标签、英语以及 442 像素窄屏。旧路径情景按钮在国家详情中不存在，国家基础整合年数入口仍可用。

## 下一步

本轮保留在隔离分支，不合并、不推送、不公开部署。正式发布前使用完整集成构件重建原版、Victorian Century 和 `site/vc`，再执行公开站点回归。
