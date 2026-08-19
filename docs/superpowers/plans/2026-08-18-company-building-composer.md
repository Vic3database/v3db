# 公司建筑组合器实施计划

> **给执行者：** 实施时使用 superpowers:executing-plans，逐项完成并在每个检查点运行指定验证。

**目标：** 为原版 1.13.10 的公司板块增加 #/company/composer。用户可从图片墙选择任意数量的公司，选择每家公司唯一扩展组中的一个建筑，并在右栏查看合并后的建筑、名贵商品、文化与国家限制、按效果字段累加的繁荣效果。

**架构：** 新建无界面依赖的组合数据核心文件，负责已选公司、固定建筑、互斥扩展、去重汇总和繁荣效果数值聚合。页面控制器只处理路由、状态、HTML 和事件；普通公司筛选组件继续使用现有的公司类型、名贵商品、资料片、建筑筛选状态。组合器复用主界面的左侧筛选栏、中间 results 和右侧 detail 容器，以独立的 data-company-composer 样式组织三列。

**技术：** 原生 JavaScript、现有静态 JSON 数据、CSS、Node assert、Chrome DevTools Protocol 浏览器检查。

## 任务 1：建立可测试的组合数据核心

**文件：**
- 新建：site/app/company-composer-core.js
- 新建：scripts/check_company_composer_core.mjs

### 第一步：先编写失败的核心检查

在 scripts/check_company_composer_core.mjs 使用 node:vm 载入尚未存在的 company-composer-core.js，并从 window.COMPANY_COMPOSER_CORE 取得 composeCompanyBuildings。构造四家最小公司数据，覆盖以下情形：

1. 两家公司固定建筑交集去重，并按传入的五类建筑目录顺序返回。
2. 一家公司的两个 extension_building_types 只接受当前选择的一项；无效扩展键必须忽略。
3. 取消扩展后该建筑立即从汇总中消失。
4. 相同 category.key 与相同修正 key 的 0.10、0.05 合并为 0.15；不同字段保持独立；无数值词条不参与数值合并。
5. 名贵商品、文化、国家限制按 key 去重，已选公司顺序与输入的有序公司键一致。

运行：

    node scripts/check_company_composer_core.mjs

预期：导入失败，因为核心文件尚未创建。

### 第二步：实现数据核心

在 site/app/company-composer-core.js 的 IIFE 中定义 composeCompanyBuildings({ companies, selectedCompanyKeys, selectedExtensions, buildingGroups })，并通过 window.COMPANY_COMPOSER_CORE 暴露。函数不得读取 DOM、全局状态或本地化函数。

实现细节：

- 使用公司键建立索引，按 selectedCompanyKeys 的顺序收集实际存在的公司；重复键只保留首次出现。
- selectedExtensions 为以公司键为属性的普通对象。只有值存在于该公司的 extension_building_types 时才纳入汇总。每家公司最多读取一个值，满足用户确认的单一扩展组约束。
- 固定建筑来自 building_types，扩展建筑来自有效的已选扩展。两者放入集合，再依照传入 buildingGroups 的组顺序和每组 buildingKeys 顺序生成非空 buildingGroups。把未包含在目录中的键单列为 unclassifiedBuildingKeys，供调用方在开发检查中发现目录遗漏；1.13.10 的实际公司数据必须为空。
- 为每个已选公司返回 extensionRows，其中含公司键、完整可选扩展键数组和当前选择。没有扩展项的公司不生成行。
- 对 possible_prestige_goods、referenced_cultures、referenced_countries 分别按键去重，同时保留首个原始对象，供界面保留官方本地化字段和链接键。
- 对每个 prosperity_modifiers 按 category.key 加修正 key 聚合有限数值，保留首条的 category、loc 与修正键。数值累加后四舍五入到 12 位小数，避免浮点显示为 15.000000000000002%。没有有限数值的词条保留为独立项，并携带来源公司键。最终先按类别键分组，再保持类别首次出现顺序和字段首次出现顺序。

核心结果至少包含 selectedCompanies、buildingGroups、unclassifiedBuildingKeys、extensionRows、prestigeGoods、cultures、countries、prosperityGroups。

### 第三步：运行核心检查

    node scripts/check_company_composer_core.mjs

预期：所有断言通过，并输出 company composer core checks passed。

### 第四步：提交检查点

    git add site/app/company-composer-core.js scripts/check_company_composer_core.mjs
    git commit -m "feat: add company composer aggregation core"

提交前只允许暂存上述两个文件；若工作区已有无关改动，保留且不暂存。

## 任务 2：接入状态、路由、入口和本地化

**文件：**
- 修改：site/app/runtime.js
- 修改：site/app/data.js
- 修改：site/app/ui.js
- 修改：site/app/boards.js
- 修改：site/index.html
- 修改：site/locales/ui.zh-Hans.js
- 修改：site/locales/ui.en.js
- 修改：scripts/site_frontend_sources.mjs
- 新建：site/app/company-composer.js
- 新建：scripts/check_company_composer_contract.mjs

### 第一步：先编写失败的合同检查

在 scripts/check_company_composer_contract.mjs 读取源码并断言：

- runtime.js 有独立 companyComposer 状态，含有序 selectedCompanyKeys 和按公司键保存的扩展选择；不会复用 companySolver。
- index.html 加载 company-composer.js，存在两个公司工具入口容器，既有 companySolverEntry 和 companySolverDetailPane 保持不变。
- ui.js 能识别 #/company/composer，不可用资料库访问该路由时回退 #/company，并令页面数据属性 companyComposer 为真。
- boards.js 同时渲染产业组合和公司建筑组合器入口，并在组合器状态调用新的组合器渲染函数。
- 中英文语言文件都有入口、说明、已选公司、组合建筑、可选扩展、文化与国家限制、繁荣效果和空状态所需键。
- site_frontend_sources.mjs 包含新的核心与控制器文件。

运行：

    node scripts/check_company_composer_contract.mjs

预期：失败，因为相关代码尚未接入。

### 第二步：加入状态和数据重置

在 runtime.js 的 state 中增加：

    companyComposer: {
      selectedCompanyKeys: [],
      selectedExtensions: {},
    },

状态保持独立，不在普通公司详情、产业组合求解器和筛选变化时清空。在 data.js 的 resetDatasetState() 中将该对象恢复为空，防止切换数据版本后保留失效公司键。

在 els 中增加新的 companyComposerEntry 引用。index.html 在结果头下方保留 companySolverEntry，并紧邻加入 companyComposerEntry。组合器核心和控制器在既有公司求解器脚本之后按顺序加载：

    <script src="app/company-composer-core.js?v=20260818-company-composer1"></script>
    <script src="app/company-composer.js?v=20260818-company-composer1"></script>

site_frontend_sources.mjs 以相同依赖顺序列入核心与控制器文件。控制器从 window.COMPANY_COMPOSER_CORE 读取核心函数；缺失时显示本地化错误状态而不影响普通公司板块。该形式避免本地 file 协议下的模块和 Worker 来源限制。

### 第三步：加入路由、可用性和工具入口

在 company-composer.js 实现以下函数：

- companyComposerAvailable()：本轮限制为非独立站、已加载版本为 1.13.10、存在公司数据。函数只用数据可用性判断，以后资料库支持时修改这一处即可。
- setCompanyComposerView()：隐藏瞬态浮层，调用 changeBoard("company", "companyComposer")，清空普通公司详情键，写入 #/company/composer，等待组合器核心与当前路由数据块，最后 render()。
- companyComposerState()：规范化有序键数组和扩展对象，删除数据中不存在的公司和不再合法的扩展键。

在 ui.js 的散列解析中，紧接产业组合路由后处理 company/composer。合法时进入 companyComposer；不合法时回退普通 #/company。在 render() 增加 document.body.dataset.companyComposer。在 detailRouteKey() 明确将 company/solver 和 company/composer 返回空字符串，保证组合器不被普通公司详情页逻辑误判。

在 boards.js 的 renderCompanyBoard()：

- 组合器状态优先隐藏两个普通入口、隐藏旧求解器右栏并调用 renderCompanyComposerBoard()。
- 普通公司板块恢复时，按各自可用性显示两个独立入口。产业组合入口内容、行为和缓存版本不改变；组合器入口使用 data-company-composer-entry。

为入口点击新增一次性事件绑定。两个入口都只改变路由，不重置对方的状态。

### 第四步：加入本地化

在中英文语言文件加入 board.company.composer 系列键。中文使用“公司建筑组合器”“选择公司并查看固定建筑、可选扩展与合并效果”“已选公司”“组合建筑”“固定建筑”“可选扩展”“文化或国家限制”“繁荣效果”“尚未选择公司”；英文使用对应的简洁自然文本。类别标题继续复用既有 board.company.solverGroup 系列键，不重复建立建筑分类译文。

### 第五步：运行合同检查

    node scripts/check_company_composer_contract.mjs
    node scripts/check_company_solver_contract.mjs

预期：新增合同通过，已有产业组合合同继续通过。

### 第六步：提交检查点

    git add site/app/runtime.js site/app/data.js site/app/ui.js site/app/boards.js site/index.html site/locales/ui.zh-Hans.js site/locales/ui.en.js scripts/site_frontend_sources.mjs site/app/company-composer.js scripts/check_company_composer_contract.mjs
    git commit -m "feat: add company composer route and state"

只暂存列出的组合器相关文件；如共享文件含有已有无关改动，使用 git add -p 精确选择本功能区块。

## 任务 3：实现三列界面与合并总览

**文件：**
- 修改：site/app/company-composer.js
- 修改：site/app/filters.js
- 修改：site/app/ui.js
- 修改：site/styles/shell.css
- 修改：site/styles/records.css

### 第一步：收敛组合器专用的筛选范围

在 filters.js 增加 matchesCompanyComposerFilters(company)。该函数保留现有公司筛选的名称搜索、公司类型、名贵商品、资料片和建筑条件，并不读取战略区域和地理区域状态；建筑条件仍复用 companyMatchesResourceFilter() 和现有“包含产业特许”开关的语义。这样组合器左栏只显示用户指定的四类公司筛选，且从普通公司板块带来的地区筛选不会在组合器内静默影响图片墙。

在 ui.js 的筛选分组同步中，让组合器打开当前有值的公司筛选分组；在 shell.css 用 data-company-composer="true" 隐藏左栏的国家、地区、意识形态、法律、文化等无关筛选节，保留搜索、建筑、公司类型、名贵商品和资料片。建筑节内保留既有“包含产业特许”令牌，因为它属于现有建筑筛选语义。

### 第二步：渲染图片墙与选择交互

在 company-composer.js 完成 renderCompanyComposerBoard()：

- 中列的结果头显示符合筛选的公司数和已选公司数，移除普通排序下拉框，只按既有 sortCompanies 排序图片墙。
- 调用 matchesCompanyComposerFilters() 得到全部筛选结果，不做分页。已选公司从图片墙中排除，顶部“已选公司”区域按 selectedCompanyKeys 顺序渲染，即使筛选条件已不命中也持续显示。
- 每张公司卡为可聚焦 button，含公司图标、隐藏名称和 aria-label。未选区只显示图标；悬停或焦点时图标放大并出现名称。卡片点击加入或取消；取消时删除该公司的扩展选择。
- 委托点击处理 data-company-composer-company 和键盘原生按钮行为。每次选择后只重新 render()，不改动筛选集合。
- 选择公司后，调用核心汇总函数并刷新右栏；无选择时渲染本地化空状态。

卡片不提供详情跳转。右栏中的公司名、建筑和名贵商品使用 #/company/<key>、#/building/<key>、#/goods/<key>，依靠浏览器返回历史恢复组合器内存状态。

### 第三步：渲染组合建筑、扩展和其他汇总

在 company-composer.js 使用任务 1 的核心返回值渲染 renderCompanyComposerDetail()：

1. “组合建筑”按现有五类 companySolverBuildingGroups 的顺序输出。每项为建筑图标和详情链接；固定与扩展已在核心中合并去重。
2. “可选扩展”按已选公司顺序逐行显示。每行的按钮只包含扩展建筑图标，工具提示和辅助标签提供官方名称。点击未选项写入对应公司键；点击当前项删除该键；因此选择另一项会替换原项。选择行为即时更新上方建筑。
3. 名贵商品区只在有数据时显示，采用现有 goodsIconHtml 和普通正文色，不使用低对比蓝色链接色。
4. 限制区合并文化和国家引用，分别给出详情链接；两者均无时隐藏整个区块。
5. 繁荣效果区按照核心的作用类别分节，使用现有 modifierSummaryLabel 与 modifierValueLabel 格式化已累加对象，确保 0.15 显示为 +15%。不同字段与非数值条目保持独立。

在 company-composer.js 暴露仅供浏览器检查的 window.__companyComposerDebug()，返回已选公司键、已选扩展、分组建筑键、无分类建筑键和聚合效果值。正式 UI 不显示此调试对象。

### 第四步：编写三列与图片墙样式

在 shell.css 增加组合器独立布局：桌面保留左筛选栏，results 位于中间，detail 固定为右栏。中列与右栏共享左栏以外的空间，采用 minmax(0, 1.25fr) minmax(360px, 1fr) 的比例；全部列使用绝对定位既有面板边距，确保三者边界不重叠。组合器强制显示右栏，隐藏旧 companySolverDetailPane，并让 results 与 detail 的滚动相互独立。

在 records.css 建立以下选择器：

- .company-composer-wall、.company-composer-selected、.company-composer-card：图片墙图标尺寸、成就板块相近的网格间距、悬停缩放、焦点轮廓和选中状态。
- .company-composer-summary、.company-composer-building-group、.company-composer-extension-row：建筑总览、扩展行、名贵商品、限制与繁荣效果的紧凑分组。
- 建筑图标与公司图标保持无额外卡片框，扩展选择使用现有筛选令牌同类的选中边框。

在 @media (max-width: 760px) 将组合器改为页面纵向阅读：左栏、图片墙、合并总览依次占满可用宽度，不出现横向滚动；右栏不覆盖中列内容。

### 第五步：静态验证

    node scripts/check_company_composer_core.mjs
    node scripts/check_company_composer_contract.mjs
    node scripts/check_company_solver_contract.mjs

预期：三项通过。

### 第六步：提交检查点

    git add site/app/company-composer.js site/app/filters.js site/app/ui.js site/styles/shell.css site/styles/records.css
    git commit -m "feat: render company building composer"

若共享文件含有无关区块，使用 git add -p。

## 任务 4：浏览器回归、真实数据审计与工作记录

**文件：**
- 新建：scripts/check_company_composer_browser.mjs
- 新建：docs/worklog/2026-08-18-company-building-composer.md
- 修改：WORKLOG.md
- 视实际共享范围修改：.worktrees/company-industry-combination-solver/site/...

### 第一步：编写浏览器检查

以 scripts/check_company_solver_browser.mjs 的静态预览服务器和 Chrome DevTools Protocol 工具函数为基础，新建 scripts/check_company_composer_browser.mjs，避免修改产业组合浏览器检查。对 ?version=1.13.10&lang=zh-Hans#/company/composer 验证：

1. 公司板块存在两个入口；点击新入口进入 #/company/composer。1.13.9 访问同一路由应回退 #/company。
2. 左栏可见名称搜索、建筑、公司类型、名贵商品、资料片和“包含产业特许”，地区筛选不可见。
3. 桌面下筛选栏、中列和右栏互不重叠；中列含全部筛选公司且无分页控件；公司卡显示图标、悬停或焦点时显示名称。
4. 选择两个实际有扩展项的公司。已选公司出现在顶部且按点击顺序；将筛选改到不含其中一家公司时，顶部仍保留且墙体不重复该公司；取消后扩展状态一并删除。
5. 选择一家公司扩展中的第一项，确认建筑总览新增该建筑；选择第二项时第一项消失、第二项出现；再点第二项时该扩展取消。
6. 从页面调试对象读取合并建筑，确认每个键只出现一次，顺序符合 companySolverBuildingGroups 的 10、16、7、10、5 类目录。
7. 选择拥有同一数值繁荣效果字段的两家公司，例如 company_a_markwald_and_company 与另一家同含 state_trade_advantage_mult 的公司，确认调试汇总值为两者源数据数值之和，页面显示百分比格式。
8. 检查名贵商品、限制的重复键只渲染一次；所有对应链接可见并指向普通详情路由。
9. 在 390×844 视口确认无页面横向溢出，三部分顺序可读，右栏不会遮挡图片墙。
10. 在 lang=en 验证新入口和空状态显示英文文本。

### 第二步：运行全部相关检查

    node scripts/check_company_composer_core.mjs
    node scripts/check_company_composer_contract.mjs
    node scripts/check_company_composer_browser.mjs
    node scripts/check_company_solver_core.mjs
    node scripts/check_company_solver_worker.mjs
    node scripts/check_company_solver_contract.mjs
    node scripts/check_company_solver_browser.mjs

预期：全部通过。浏览器检查若报运行时异常，先修复异常，重新从核心、合同到浏览器顺序执行，不以截图替代断言。

### 第三步：同步现有求解器工作树

现有 D:\Bot\Vic3\Victoria3_DB\.worktrees\company-industry-combination-solver 用于保留同一公司功能分支。先以只读检查比较本轮触及文件：

    git -C .worktrees/company-industry-combination-solver status --short
    git -C .worktrees/company-industry-combination-solver diff -- site/app/company-solver.js site/app/runtime.js site/app/ui.js site/app/boards.js site/app/filters.js site/styles/shell.css site/styles/records.css site/index.html

确认不覆盖该工作树的独有修改后，只同步本轮新增或明确修改的组合器文件与同一共享文件对应区块，并在该工作树重新运行核心、合同与浏览器检查。若发现冲突，不覆盖，记录差异并停在冲突点等待处理。

### 第四步：记录与最终提交

新增工作记录 docs/worklog/2026-08-18-company-building-composer.md，记载本地实现范围、1.13.10 的入口限制、核心聚合规则、实际检查命令和结果；在 WORKLOG.md 的“当前状态”和“详细记录”补一条简短索引。不要写入尚未发生的推送或部署状态。

    git add scripts/check_company_composer_browser.mjs docs/worklog/2026-08-18-company-building-composer.md WORKLOG.md
    git commit -m "test: verify company building composer"
    git status --short --branch

最终状态报告必须区分本地实现、Git 提交、远程推送和公开部署。未获得明确授权时不得推送或部署。
