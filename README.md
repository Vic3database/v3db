# Vicdata

Vicdata 是一个面向《维多利亚 3》的静态资料查询网站。当前公开站点使用 Victoria 3 `1.13.9` 数据，提供国家、地区、文化、公司和意识形态资料的浏览、筛选、搜索和地图查看。

项目与 Paradox Interactive 没有关联。仓库中的游戏数据、地图、图像、名称和商标来自《维多利亚 3》文件解析与网页资源整理，只用于让页面显示对应资料。项目代码的授权不包含这些游戏内容。

## 内容范围

网站入口是 `site/index.html`。公开站点当前只发布一个数据版本，版本配置在 `site/versions.js`，对应数据入口和地图文件为：

```text
site/versions/1.13.9/data-index.js
site/versions/1.13.9/map-data.js
```

页面首批提供简体中文与英语。右上角的 Languages 图标可以切换语言，分享链接可使用 `?lang=zh-Hans` 或 `?lang=en`；语言切换保留当前板块、详情、筛选和滚动位置。结构数据与语言包按资料板块加载，全局搜索同时匹配中文名、英文名和内部键。

仓库保留页面实际会加载的图标、地图图片、站点脚本和样式。历史版本数据、完整本地游戏目录、开发过程输出和调试文件不属于公开站点内容。

## 本地运行

需要本机安装 Node.js。仓库根目录下运行：

```powershell
node scripts/serve_site.mjs site 8876
```

然后打开：

```text
http://127.0.0.1:8876/
```

如果端口被占用，可以换一个端口：

```powershell
node scripts/serve_site.mjs site 8878
```

## 成就资料与图标

原版 1.13.9 的成就资料、英文名和站内图标按以下顺序生成：

```powershell
node scripts/extract_vic3_countries.mjs --game-path "D:\SteamLibrary\steamapps\common\Victoria 3" --version 1.13.9 --out output\vic3_1.13.9 --database database\vic3_1.13.9
node scripts/build_achievement_assets.mjs
node scripts/build_wiki.mjs --database database\vic3_1.13.9 --out site\versions\1.13.9
```

随后运行 `node scripts/check_achievement_database.mjs`、`node scripts/check_achievement_board_contract.mjs` 与 `node scripts/check_publish_bundle.mjs`。`database/` 和 `output/` 为本地生成资料，不纳入提交；站点实际使用的 WebP 图标位于 `site/assets/achievements/`。

## 检查

发布前可以运行：

```powershell
node scripts/check_publish_bundle.mjs
node scripts/check_ui_ideology_contracts.mjs
node scripts/check_about_page.mjs
node scripts/check_country_map_selection.mjs
node scripts/check_site_asset_coverage.mjs
node scripts/check_filter_order.mjs --file site/index.html
node scripts/check_multilingual_bundles.mjs --site-version site/versions/1.13.9
node scripts/check_multilingual_legacy_fields.mjs
git diff --check
```

其中 `check_site_asset_coverage.mjs` 会对照本地游戏资源检查站点图片覆盖情况。没有本地游戏文件时，这项检查可能无法完成。

## 站内公告

首页公告由仓库根目录的 `announcements.md` 维护。每条公告使用 `## YYYY-MM-DD｜标题` 作为标题行，标题后写正文；正文可以用空行分段。编辑完成后运行：

```powershell
node scripts/build_announcements_data.mjs
node scripts/check_announcements.mjs
node scripts/check_publish_bundle.mjs
```

三个命令通过后再上传 `site/` 目录。发布检查会拒绝与 `announcements.md` 不一致的 `site/announcement-data.js`。

## 部署

仓库包含 GitHub Pages 工作流。公开仓库启用 Pages 后，可以使用 `.github/workflows/pages.yml` 发布 `site/` 目录。

项目准备使用的公开域名是：

```text
https://vic3database.org/
```

## 反馈

希望网站新增的功能可以发送到：

```text
vic3database@outlook.com
```

## 声明

Victoria 3 是 Paradox Interactive 的游戏。Vicdata 是玩家制作的数据浏览工具，与 Paradox Interactive 没有从属、授权或合作关系。
