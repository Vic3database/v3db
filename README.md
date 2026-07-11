# Vicdata

Vicdata 是一个面向 Victoria 3 数据查询的静态网站。当前公开发布版本只包含 Victoria 3 `1.13.9` 的站点数据、地图数据，以及页面实际引用的图标和地图图片。

这个项目不是 Paradox Interactive 或 Victoria 3 官方项目。仓库中的游戏数据、地图和图像素材来自本地 Victoria 3 安装目录的解析与转换，只用于让网页能够显示对应资料。项目代码的授权不会覆盖这些游戏内容，也不会把 Victoria 3 的原始数据、图片、名称或商标重新授权给其他人。

## 当前内容

网站入口在 `site/index.html`。版本配置在 `site/versions.js`，目前只指向：

```text
site/versions/1.13.9/data.js
site/versions/1.13.9/map-data.js
```

已跟踪的站点图片资源是网页实际会加载的文件，包括公司图标、建筑图标、意识形态图标、利益集团图标、名贵商品图标、DLC 图标和两张地图图片。旧版本数据、完整游戏目录、本地生成数据库和调试输出不提交到仓库。

## 本地运行

需要本机已安装 Node.js。仓库根目录下运行：

```powershell
node scripts/serve_site.mjs site 8876
```

然后打开：

```text
http://127.0.0.1:8876/
```

如果端口被占用，可以换一个端口，例如：

```powershell
node scripts/serve_site.mjs site 8878
```

## 校验

公开发布前可以运行这些检查：

```powershell
node scripts/check_publish_bundle.mjs
node scripts/check_ui_ideology_contracts.mjs
node scripts/check_country_map_selection.mjs
node scripts/check_site_asset_coverage.mjs
node scripts/check_filter_order.mjs --file site/index.html
git diff --check
```

`check_publish_bundle.mjs` 会检查公开站点只保留 `1.13.9`，并确认配置、首页、脚本和数据引用到的文件存在。`check_site_asset_coverage.mjs` 会把站点资源和本地 `game` 目录中的原始图片做对照，因此需要本地保留 Victoria 3 游戏目录镜像。

## GitHub Pages

仓库公开后，可以使用 `.github/workflows/pages.yml` 部署 GitHub Pages。工作流会上传 `site/` 目录，不会上传仓库根目录或本地生成目录。

如果仓库仍是私有状态，当前账号计划可能无法启用 GitHub Pages。改为公开仓库后，需要在仓库设置里启用 Pages，并使用 GitHub Actions 作为发布来源。部署成功后，常见地址形式是：

```text
https://vic3database.github.io/v3db/
```

## 许可证

当前仓库还没有设置项目许可证。公开仓库前建议先决定是否为项目代码添加开源许可证。无论选择哪一种代码许可证，README 顶部的非官方说明和素材边界都应保留，因为游戏数据和图像素材不属于项目代码许可证的授权范围。

## 致谢与声明

Victoria 3 是 Paradox Interactive 的游戏。Vicdata 只是一个玩家制作的数据浏览工具，与 Paradox Interactive 没有从属、授权或合作关系。
