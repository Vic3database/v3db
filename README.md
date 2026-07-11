# Vicdata

Vicdata 是一个面向《维多利亚 3》的静态资料查询网站。当前公开站点使用 Victoria 3 `1.13.9` 数据，提供国家、地区、文化、公司和意识形态资料的浏览、筛选、搜索和地图查看。

项目与 Paradox Interactive 没有关联。仓库中的游戏数据、地图、图像、名称和商标来自《维多利亚 3》文件解析与网页资源整理，只用于让页面显示对应资料。项目代码的授权不包含这些游戏内容。

## 内容范围

网站入口是 `site/index.html`。公开站点当前只发布一个数据版本，版本配置在 `site/versions.js`，对应数据文件为：

```text
site/versions/1.13.9/data.js
site/versions/1.13.9/map-data.js
```

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

## 检查

发布前可以运行：

```powershell
node scripts/check_publish_bundle.mjs
node scripts/check_ui_ideology_contracts.mjs
node scripts/check_about_page.mjs
node scripts/check_country_map_selection.mjs
node scripts/check_site_asset_coverage.mjs
node scripts/check_filter_order.mjs --file site/index.html
git diff --check
```

其中 `check_site_asset_coverage.mjs` 会对照本地游戏资源检查站点图片覆盖情况。没有本地游戏文件时，这项检查可能无法完成。

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
