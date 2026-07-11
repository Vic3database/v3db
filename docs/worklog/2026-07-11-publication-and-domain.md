# 2026-07-11 发布与域名工作记录

## 工作范围

本次工作围绕 `Vic3database/v3db` 仓库的公开发布准备展开，目标是把当前 Vicdata 网站发布到 GitHub Pages，并绑定 `vic3database.org`。公开站点目前只保留 Victoria 3 `1.13.9` 版本的数据和页面实际引用的资源，不继续携带旧版本数据。

仓库地址为 `https://github.com/Vic3database/v3db`，默认分支为 `main`。远程地址已经指向 `https://github.com/Vic3database/v3db.git`，本地 Git 提交身份为 `Vic3database <302398767+Vic3database@users.noreply.github.com>`。仓库当前为公开仓库。

## 已完成事项

发布包已经整理为单版本结构。`site/versions.js` 只指向 `1.13.9`，对应数据文件为 `site/versions/1.13.9/data.js` 和 `site/versions/1.13.9/map-data.js`。旧版本变更记录文件已经从公开发布包中移除。公开仓库中保留的图片资源只覆盖页面会加载的公司、建筑、意识形态、利益集团、名贵商品、DLC 图标和地图图片。

GitHub Pages 工作流已经加入 `.github/workflows/pages.yml`，发布来源使用 GitHub Actions。工作流上传 `site/` 目录作为 Pages artifact，不上传仓库根目录、本地生成目录或完整游戏目录。Pages 构建类型已经切换为 `workflow`。

README 已补充项目说明、非官方声明、本地运行方法、检查命令、GitHub Pages 发布说明、自定义域名 DNS 记录和许可证状态。当前仓库没有添加许可证文件，因此公开代码仍保留默认版权状态。README 中保留了游戏数据和图像素材不属于项目代码许可证授权范围的说明。

域名 `vic3database.org` 已在 GitHub Pages 中配置为自定义域名。DNS 记录已经按 GitHub Pages 要求设置，根域名使用四条 A 记录和四条 AAAA 记录，`www` 使用 CNAME 指向 `vic3database.github.io`。检查结果显示 `www.vic3database.org` 会重定向到 `https://vic3database.org/`。

HTTPS 证书已经由 GitHub Pages 签发并通过审核。证书覆盖 `vic3database.org` 和 `www.vic3database.org`，到期时间为 2026-10-09。GitHub Pages 的 `Enforce HTTPS` 已打开，Pages 配置显示 `https_enforced: true`，站点入口为 `https://vic3database.org/`。

## 相关提交与部署

本次公开发布相关提交如下：

```text
5fb9a7a Publish single-version Vicdata site
3e445d9 Add public repository README
b2b1b4a Document custom domain setup
```

GitHub Actions 中 `Deploy Vicdata site` 工作流已经成功运行。成功部署记录为运行 ID `29148443022`，对应提交 `b2b1b4a855992dc764922e9ae88d886640d2fc0b`，完成时间为 2026-07-11 09:53:16 UTC。

此前有两次失败运行，原因是 Pages 尚未切换到 GitHub Actions 发布来源。切换后重新运行同一工作流已经成功。

## 已验证结果

发布包检查已经通过：

```powershell
node scripts/check_publish_bundle.mjs
```

该检查确认公开发布包只保留 `1.13.9`，并确认首页、版本配置、脚本和数据引用的文件存在。

站点数据和界面契约检查已经通过：

```powershell
node scripts/check_ui_ideology_contracts.mjs
node scripts/check_country_map_selection.mjs
node scripts/check_site_asset_coverage.mjs
node scripts/check_filter_order.mjs --file site/index.html
git diff --check
```

浏览器验证已覆盖首页、公司页、意识形态页和地区地图页。验证结果显示首页版本选择只有 `1.13.9`，公司页和意识形态页图标没有加载失败，地区地图画布正常显示，测试过程中没有页面错误、请求失败或控制台错误。

域名和证书检查结果显示：

```text
vic3database.org           HTTPS 200
www.vic3database.org       301 -> https://vic3database.org/
GitHub Pages certificate   approved
GitHub Pages HTTPS         enforced
```

刚打开 HTTPS 强制跳转后，GitHub 边缘缓存可能会在数分钟内继续返回旧的 HTTP 结果。以后如果浏览器仍提示证书不安全，先确认访问的是 `https://vic3database.org/`，再尝试关闭旧标签页、使用无痕窗口或清除该站点缓存。

## 后续注意事项

仓库当前没有许可证文件。若以后希望允许他人复用项目代码，需要先决定许可证类型，再加入 `LICENSE` 文件，并同步更新 README。无论选择哪一种代码许可证，都需要继续说明 Victoria 3 的游戏数据、图像、名称和商标不属于本项目代码许可证授权范围。

`site/versions/1.13.9/data.js` 约 50 MB，推送时 GitHub 曾提示超过建议大小，但没有超过单文件硬性限制。继续增加版本数据时，需要考虑拆分数据、压缩加载或改用外部发布资产。

如果以后恢复多版本，应该先更新 `site/versions.js` 和发布包检查脚本，再重新检查页面入口、版本选择、资源覆盖和地图加载。当前公开发布目标仍是只放 `1.13.9`。

域名 DNS 后续不要加入通配符记录。根域名继续保留 GitHub Pages 的 A/AAAA 记录，`www` 继续保留 CNAME 到 `vic3database.github.io`。GitHub Actions Pages 模式下，自定义域名由仓库 Pages 设置保存，不依赖 `site/CNAME` 文件。
