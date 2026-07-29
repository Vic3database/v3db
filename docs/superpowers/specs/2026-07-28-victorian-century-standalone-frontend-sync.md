# Victorian Century 独立站前端同步设计

## 目标

将 `Victorian Century Database/` 从 2026 年 6 月的单体页面升级到当前 `site/` 使用的模块化前端，使 Victorian Century 数据库获得首页、国家、文化、地域、公司、意识形态、法律和科技板块，以及当前的地图交互、标签提示框、图标资源和加载流程。同步后的页面继续显示 Victorian Century 数据集与 1.13.9 版本信息。

## 同步边界

页面结构、`app/` 模块、`styles/` 模块和各板块需要的共用资源由 `site/` 同步到 `Victorian Century Database/`。独立站保留自己的 `data-index.js`、数据分块、兼容 `data.js` 和 `map-data.js`，不读取 `site/versions/` 或原版资料库的数据文件。

独立站入口移除版本选择、版本组选择、更新日志入口、公告数据和新闻数据。顶栏保留搜索、设置、关于、主题切换和各资料板块入口；站点名称和关于内容使用 Victorian Century 数据集信息。页面不引用主站路径之外的脚本、样式或资源。

当前构建器生成分块数据；独立站还保留 `data.js`，以维持旧页面兼容和便于回退。同步后的模块化前端以 `data-index.js` 和分块数据为正式读取入口，兼容文件不参与新页面的加载。

## 实施与验证

先为独立站入口提供一份仅含单版本数据的本地配置，使模块化运行时能够加载 Victorian Century 的七类分块数据和本地地图索引。随后同步前端模块、样式和必要资源，并删除旧页面专用的版本控件依赖。数据构建流程继续通过 `scripts/check_victorian_century_update.mjs` 完成；构建后应重新生成数据分块、兼容 `data.js` 和地图索引。

静态检查覆盖脚本语法、独立入口的本地资源引用、分块数据索引和地图索引。浏览器检查以 `Victorian Century Database/index.html` 为准，确认标题和元信息显示 Victorian Century，顶栏不出现版本选择或更新日志，首页及八个板块可打开，国家、地域和公司数据来自 VC 数据集，地图可显示并能重置焦点，控制台没有页面错误。
