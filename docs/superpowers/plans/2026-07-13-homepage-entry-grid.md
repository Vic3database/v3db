# Vicdata 主页入口网格实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将首页改为带游戏图标的五列资料入口，并在同一页面展示使用说明、版权声明、公告与游戏资讯占位。

**Architecture:** 继续使用现有哈希路由和 `renderHomeBoard()`。首页内容写入现有结果栏和详情栏，不新建页面；可用模块调用既有 `setView()` 路由，未完成模块显示筹备状态且不绑定跳转。主页专用样式只覆盖 `body[data-view="home"]`，保持其他资料板块的地图与面板布局不变。

**Tech Stack:** 静态 HTML、原生 JavaScript、CSS、Node.js 静态检查脚本。

---

### Task 1: 建立主页结构检查

**Files:**
- Create: `scripts/check_homepage_layout.mjs`

- [ ] **Step 1: 写入失败检查**

检查 `renderHomeBoard()` 是否定义 18 个分类入口、是否有五列网格、是否有版权、使用说明、公告和游戏资讯占位，并检查每个指定图标已复制到 `site/assets/home`。

- [ ] **Step 2: 运行检查，确认旧主页失败**

Run: `node scripts/check_homepage_layout.mjs`

Expected: 以缺少首页入口数据、主页结构或主页资源的断言退出。

### Task 2: 实现主页入口与侧栏内容

**Files:**
- Modify: `site/app.js:1763-1800`
- Modify: `site/styles.css:现有 .home-board 和 .home-card 规则`
- Create: `site/assets/home/*.png`

- [ ] **Step 1: 复制指定游戏图标**

将用户指定的 14 个游戏图标复制到 `site/assets/home`，使用原始文件名。现有可用入口显示实时资料数量；更新日志进入既有 `#/changelog`；其余八项显示“筹备中”。

- [ ] **Step 2: 修改首页渲染函数**

在 `renderHomeBoard()` 中输出站点说明与版权文字、入口数据和图标、网站使用说明按钮、右上公告以及右下游戏资讯占位。可用入口保持 `data-home-view`，更新日志使用 `data-home-view="changelog"`，使用说明通过 `openInfoDialog("about")` 打开既有站内说明浮窗。

- [ ] **Step 3: 添加主页专用样式**

首页隐藏筛选和地图操作面板，将结果区改为五列入口网格，详情区上下分隔为公告与游戏资讯。入口按钮使用图标左、文字右的横向布局，并使用现有深色面板、金色边线与蓝灰强调色；窄屏时逐级降至三列、两列、一列。

### Task 3: 记录后续资讯工作并验证

**Files:**
- Modify: `todolist.md:中优先级`

- [ ] **Step 1: 写入待办事项**

在中优先级中加入“整理首页游戏资讯内容与链接来源”，明确当前首页仅显示占位。

- [ ] **Step 2: 运行静态检查**

Run: `node scripts/check_homepage_layout.mjs; node --check site/app.js; git diff --check`

Expected: 三项命令退出码均为 0。

- [ ] **Step 3: 浏览器核验**

打开本地站点的 `#/home`，确认五列入口、左右排布、版权、公告、资讯占位；点击国家与更新日志，确认分别进入 `#/country` 与 `#/changelog`，点击使用说明确认打开既有信息浮窗。
