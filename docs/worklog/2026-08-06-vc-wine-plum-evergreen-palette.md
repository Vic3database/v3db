# 2026-08-06 Victorian Century 酒红紫、哑金与深绿主题

## 范围

Victorian Century 独立站新增专用主题。主站不加载该主题。配色以酒红 `#542734` 和梅紫 `#713748` 区分标题与选中状态，以哑金 `#b89963` 标示描边、重点文字和数值；深绿 `#1e4b42` 用于独立的黑绿控制区、当前导航、可用状态及经济页控件，不与酒红或梅紫做渐变，也不作为内容区背景光晕。建筑与商品页内容容器固定为 `#251d22`，避免继承基础样式的蓝绿色渐变。

主题未改写地图的国家、资源或地形数据色。地图继续由数据和各地图模块决定颜色，独立站主题只作用于页面框架、控件和面板。

## 实现

- 新增 `site/victorian-century-theme.css`，以共享样式令牌覆盖独立站的底色、面板、边线、正文、哑金和深绿。
- `scripts/build_victorian_century_site.mjs` 将该文件复制为独立站根目录的 `vc-theme.css`，并将其放在 `styles.css` 后加载。
- `scripts/check_victorian_century_palette.mjs` 检查主题颜色、构建接线、独立站根目录覆盖和浏览器令牌断言。
- `scripts/check_victorian_century_standalone_site.mjs` 支持由环境变量传入临时独立站与发布副本目录，并将 `vc-theme.css` 纳入二者的字节一致性检查。
- `scripts/check_victorian_century_browser.mjs` 在建筑和商品页确认根元素实际值为背景 `#181216`、哑金 `#b89963`、深绿 `#1e4b42`，并确认已加载 `vc-theme.css`。

## 验证

- `node scripts/check_victorian_century_palette.mjs`
- `node scripts/build_victorian_century_site.mjs --target <临时独立站> --publish-target <隔离工作区内发布副本> --vc-database D:\Bot\Vic3\Victoria3_DB\database\victorian_century`
- `VICTORIAN_CENTURY_SITE_ROOT=<临时独立站> VICTORIAN_CENTURY_PUBLISHED_ROOT=<发布副本> node scripts/check_victorian_century_standalone_site.mjs`
- `node scripts/check_victorian_century_browser.mjs file:///C:/Users/SamuY/AppData/Local/Temp/vc-wine-plum-evergreen-0320bb841ee64635ba966d0e0d90fa62/standalone/index.html building goods`
- `node --check scripts/build_victorian_century_site.mjs`
- `node --check scripts/check_victorian_century_browser.mjs`
- `git diff --check`
