# 首页入口、建筑差异标注与 1.13.10 公告设计

## 目标

更新首页游戏内容入口图标和顺序，接入 Victorian Century Workshop 缩略图；根据原版 1.13.10 与 Victorian Century 建筑数据的实际字段差异，在建筑列表卡片和详情标题显示“VC调整”；更新并精简站内公告。

## 范围与方案

### 首页入口

继续使用 `site/app/boards.js` 的现有入口数组和分类结构，不调整布局。将 Victorian Century 入口使用 `D:/SteamLibrary/steamapps/workshop/content/529340/3219394272/thumbnail.png` 转换为项目使用的 WebP，并放入首页资源目录；入口引用该 WebP。日志、决议、事件入口分别引用 `event_default.webp`、`event_default_option.webp`、`event_protest.webp`，并将游戏内容区的顺序固定为日志、事件、决议、成就。若入口图标的原始资源已在 `site/assets/event-icons/event_icons/`，直接复用，不复制另一份图标。

### 建筑差异

在现有 VC 经济数据构建流程中，对 `database/vic3_1.13.10/buildings.json` 与 `database/victorian_century/buildings.json` 按建筑 `key` 对齐。忽略来源路径、补丁指令等数据来源元信息，只比较影响资料查阅的建筑字段；VC 与原版有字段差异时写入 `vc_change_kind: "adjusted"` 和具体 `vc_change_fields`，没有差异的共同建筑不添加调整标签。保留现有新增建筑标记逻辑。

建筑卡片继续使用现有变更标签渲染，右侧详情标题沿用现有 `victorianCenturyBadge`；补充或修正字段生成与契约检查，使列表和详情都能显示“VC调整”，并能指出调整字段。原版页面不显示 VC 调整标签。

### 公告

公告源只修改 `announcements.md`，然后运行 `scripts/build_announcements_data.mjs` 生成 `site/announcement-data.js`。保留 2026-08-10 公告及之后的内容，删除 2026-08-06、2026-08-01、2026-07-30、2026-07-28 四条旧公告，新增：

`2026-08-17｜更新公告`

更新至1.13.10；新增日志、事件、决议板块，优化全局搜索；在商品板块新增人群需求相关内容。

### 同步与验证

修改后的共用前端、资源和公告生成文件通过 `scripts/build_victorian_century_site.mjs` 同步到 `Victorian Century Database/` 和 `site/vc/`。运行首页布局、经济板块、公告、VC 独立站、发布包和 `git diff --check` 检查；额外增加建筑差异字段的静态契约，验证电子厂、化学合成厂等存在实际差异的建筑显示“VC调整”，未调整建筑不误标。

## 不在范围内

不重做首页布局，不修改建筑生产方式内容，不新增独立的版本差异页面，不删除数据库中的原始建筑或公告历史文件以外的项目文档。
