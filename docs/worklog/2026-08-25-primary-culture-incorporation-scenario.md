# 主流文化路径整合时长情景地图

## 目标

从国家详情的主流文化路径进入整合年数地图，按路径完成后的主流文化集合查看地域整合时长，并能恢复国家当前状态。

## 已完成修改

新增情景文化集合：直接路径、条件路径、阿根廷替换路径和互斥选项都能生成独立情景。阿富汗迈马纳情景保留乌兹别克与土库曼两项文化，坤都士情景只加入乌兹别克。国家详情路径和互斥选项增加“查看在这一情况下的整合时长”按钮。地图读取情景文化覆盖集合，缓存签名包含情景编号和文化集合；地图上下文显示情景标题和“恢复当前国家”按钮，地域提示增加情景与条件说明。主站、Victorian Century 独立站和 `site/vc` 均已同步共享前端，并在当前工作树保留可打开的 VC 独立站副本。

## 未解决问题

情景只展示已审计路径的静态假设，不模拟游戏时间推进、速度修正、法律修正案或实际条件是否已满足。`check_two_level_navigation.mjs` 仍有既有的顶栏缓存版本断言问题，未修改无关导航链。

## 涉及文件

- `site/app/runtime.js`
- `site/app/presentation.js`
- `site/app/ui.js`
- `site/app/map.js`
- `site/styles/map.css`
- `site/styles/records.css`
- `site/locales/ui.zh-Hans.js`
- `site/locales/ui.en.js`
- `scripts/check_primary_culture_incorporation_scenario_contract.mjs`
- `scripts/check_primary_culture_incorporation_scenario_browser.mjs`
- `Victorian Century Database/`（当前工作树检查副本）
- `site/vc/`（当前工作树检查副本）

## 测试结果

情景集合契约、原有整合年数契约、主流文化数据契约和多语言国家文化契约均通过。主站、Victorian Century 独立站和 `site/vc` 的情景浏览器检查均通过，覆盖法国加泰罗尼亚、阿富汗坤都士与迈马纳、阿根廷替换、地图恢复、中文、英文和 442 像素窄屏。VC 独立站入口为当前工作树的 `Victorian Century Database/index.html`，`site/vc/index.html` 也可检查同一共享前端。

## 下一步

本轮保持在隔离分支，不合并、不推送、不公开部署。正式发布前，使用包含全部已上线功能的集成构件重建原版、Victorian Century 独立站和 `site/vc`，再执行公开站点回归。
