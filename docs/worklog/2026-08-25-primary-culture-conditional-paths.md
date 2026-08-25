# 主流文化条件路径国家详情

## 目标

在原版和 Victorian Century 的国家详情中展示能够明确归属国家的主流文化扩展路径，区分直接获得、条件获得、互斥选择和替换，并保留脚本来源与行号。

## 已完成修改

`primary_culture_expansions.mjs` 现在将已审计的法国方言政策、阿富汗形成来源路径，以及带 `country_tags` 的安第斯联邦和巴拉圭来源条件投影为国家记录。义和团事件仍只保留在顶层条件审计中，不会写入国家详情。国家详情新增“可扩展的主流文化”折叠区域；同一文化的多条来源合并显示，南非和阿富汗选择组显示其它互斥结果，替换路径说明加入与移除的文化。中英文条件、来源类别、文件和行号已补齐。

## 未解决问题

当前只显示审计中能够稳定对应具体国家的路径。依赖当前宗主国、州地区或临时脚本变量的通用机制仍不归属到国家详情。`check_two_level_navigation.mjs` 在本工作树中仍要求过期的 `styles.css?v=20260810-topbar-cache1`，而基线页面使用 `20260822-country-incorporation-legend1`；该断言与本轮改动无关，未修改导航或缓存链。

## 涉及文件

- `scripts/primary_culture_expansions.mjs`
- `scripts/build_wiki.mjs`
- `scripts/check_primary_culture_expansion_data.mjs`
- `scripts/check_primary_culture_detail_contract.mjs`
- `scripts/check_primary_culture_detail_browser.mjs`
- `site/app/presentation.js`
- `site/locales/ui.zh-Hans.js`
- `site/locales/ui.en.js`
- `site/styles/records.css`
- `site/versions/1.13.11/data-countries-*.js`

## 测试结果

原版临时数据库生成 43 个国家、124 条直接路径、13 条条件路径、16 条替换路径，未解析效果为 0；Victorian Century 生成 50 个国家、153 条直接路径、13 条条件路径、18 条替换路径，未解析效果为 0。数据契约、详情静态契约、多语言国家与文化契约均通过。原版 Chrome 检查覆盖法国加泰罗尼亚条件、南非互斥路线、阿富汗坤都士与迈马纳两条乌兹别克来源路线、安第斯联邦与巴拉圭形成来源、阿根廷替换、英语界面和 442 像素窄屏；Victorian Century 的实际重建数据检查法国条件路径的中文和英语界面。全部检查通过且没有横向溢出。导航检查因既有缓存令牌断言失败，未纳入本轮通过项。

## 下一步

将本工作树合并至 `main` 后，更新主工作目录的 `WORKLOG.md` 与 `todolist.md`，再决定是否推送或发布。发布前需要用完整集成构件重建原版、独立 Victorian Century 和 `site/vc`，避免遗漏主工作目录中尚未合并的功能。
