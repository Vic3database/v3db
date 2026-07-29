# Victorian Century 主站入口设计

## 目标

在 Vicdata 首页增加 Victorian Century 资料库入口，并将右上角的版本选择扩展为资料库选择。Victorian Century 资料库部署在现有域名和服务器下，正式地址为 `https://vic3database.org/vc/`。

## 首页入口

首页在网站说明之后、资料分类之前显示一张独立入口卡。卡片名称为“Victorian Century 资料库”，说明该入口提供模组数据和地图，点击后跳转到 `https://vic3database.org/vc/`。

该卡片不归入外交、内政、经济、军事、社会或其他资料分类。当前只有 Victorian Century 时，独立卡片能够明确区分原版资料与模组资料。将来获得其他模组作者授权并建立资料库后，这一位置改为“模组资料库”入口行，逐项列出可访问的模组；现有 Victorian Century 卡片转入该行。

顶栏不增加常驻 Victorian Century 按钮，避免首页以外的页面出现与资料分类并列的额外入口。首页卡片承担发现入口的作用。

## 资料库选择器

现有右上角版本选择器改为资料库选择器。当前选项为“Victoria 3 原版 1.13.9”和“Victorian Century”。选择原版时打开主站，选择 Victorian Century 时打开 `https://vic3database.org/vc/`。原版的小版本、版本分组与更新日志功能继续留在原版资料库中，不混入 Victorian Century 独立站。

选择器的选项代表不同数据集，页面不在运行时切换或混合两套数据。Victorian Century 保持独立构建、独立数据索引和独立资源目录。

## 同域名部署

`Victorian Century Database/` 保持为本地生成目录。发布阶段将其内容复制到主站发布包的 `vc/` 子目录，形成服务器上的 `/var/www/vicdata/site/vc/`。Nginx 继续服务同一个域名和证书；静态资源沿用现有缓存规则。

独立站继续使用相对资源路径与哈希路由。公开地址为 `https://vic3database.org/vc/`，内部页面地址采用 `https://vic3database.org/vc/#/country` 这一形式。部署检查需要验证首页、一个数据资源和一个哈希路由回退均能从该路径访问。

## 验证范围

静态检查验证首页入口链接、资料库选择器的两个选项、`site/vc/index.html` 发布文件以及独立站相对资源引用。浏览器检查验证首页入口可达、选择器可跳转至 `https://vic3database.org/vc/`，并确认独立站标题、首页和国家页面正常加载且控制台没有页面错误。
