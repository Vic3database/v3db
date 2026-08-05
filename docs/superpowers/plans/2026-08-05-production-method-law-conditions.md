# 生产方式法律条件修正执行计划

> **执行要求：** 本轮按用户已确认的串行方式在当前会话逐项执行，每项修改都先建立失败用例。

**目标：** 删除生产方式修正后的“（按劳动力）”，并正确区分生产方式所需法律与禁用法律。

**实现方式：** 抽取器把 `unlocking_laws` 写为 `required_law`，把 `disallowing_laws` 写为 `disallowed_law`。页面分别显示“需要法律”和“禁用法律”；修正文本仅隐藏 `workforce_scaled` 的缩放说明，保留数值和按等级说明。

**涉及技术：** Node.js、静态 JSON 数据、浏览器回归测试、双语界面。

---

### 任务一：固定数据语义

**文件：** 修改 `scripts/check_economy_database.mjs`、`scripts/check_victorian_century_economy_database.mjs`、`scripts/extract_vic3_countries.mjs`。

- [x] 在两套数据库检查中断言：政府经营需要 `law_command_economy`，劳动者合作社需要 `law_cooperative_ownership`，私营所有制禁用这两项法律。
- [x] 运行数据库检查，确认旧数据因条件缺失或类型错误而失败。
- [x] 修改 `productionMethodAvailabilityConditions`，分别提取 `unlocking_laws` 与 `disallowing_laws`。
- [x] 重新生成原版和维多利亚世纪数据库，运行两套数据库检查。

### 任务二：固定页面显示

**文件：** 修改 `scripts/check_economy_board_browser.mjs`、`site/app/economy.js`、`site/locales/ui.zh-Hans.js`、`site/locales/ui.en.js`。

- [x] 浏览器检查增加三项法律条件的可见文本断言，并断言详情与组合结果都不含“（按劳动力）”。
- [x] 运行浏览器检查，确认旧页面显示失败。
- [x] 页面分别渲染所需法律、禁用法律和其他可用条件；`workforce_scaled` 修正使用无缩放后缀的文本模板。
- [x] 运行中文、英文和维多利亚世纪浏览器检查。

### 任务三：同步发布文件并验证

**文件：** 修改 `site/index.html`、`scripts/check_economy_board_contract.mjs`，重新生成 `site`、`site/versions/1.13.9` 及维多利亚世纪站点中的经济数据。

- [x] 更新经济脚本缓存版本和对应契约断言。
- [x] 运行经济数据、资产、本地化、页面契约、浏览器及发布包检查。
- [x] 检查受控文件差异，确认没有纳入工作区原有的未跟踪文件后提交。
