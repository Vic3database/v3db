# Victorian Century 主站入口实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Vicdata 首页和资料库选择器中提供 Victorian Century 入口，并把独立站发布到 `https://vic3database.org/vc/`。

**Architecture:** 原版站点仍从 `site/` 提供数据；Victorian Century 保持在 `Victorian Century Database/` 中构建。构建脚本将经过验证的独立站复制到生成目录 `site/vc/`，Nginx 继续以同一个静态站点根目录和证书提供两个入口。主站只保存相对链接 `vc/`，从本地预览和正式域名都能解析到同一目录。

**Tech Stack:** 原生 JavaScript、HTML、CSS、Node.js 内置模块、Playwright、Nginx、rsync over SSH。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `site/versions.js` | 定义原版资料库和 Victorian Century 两个可选资料库。 |
| `site/index.html` | 提供资料库选择器和首页 Victorian Century 独立入口。 |
| `site/app/runtime.js` | 保存资料库选择器的 DOM 引用。 |
| `site/app/data.js` | 渲染资料库选项；保留原版数据版本加载逻辑。 |
| `site/app/ui.js` | 用户选择 Victorian Century 时跳转到相对地址 `vc/`。 |
| `site/styles/home.css` | 让入口卡片位于首页说明内并在窄屏正常换行。 |
| `scripts/build_victorian_century_site.mjs` | 构建独立站，并在显式指定时镜像为 `site/vc/`。 |
| `scripts/check_victorian_century_main_entry.mjs` | 检查主站入口、资料库配置和发布包中的 VC 文件。 |
| `scripts/check_victorian_century_main_entry_browser.mjs` | 在浏览器中验证首页入口与选择器跳转。 |
| `scripts/check_victorian_century_standalone_site.mjs` | 同时检查独立构建目录与 `site/vc/` 发布副本。 |
| `scripts/check_publish_bundle.mjs` | 将 VC 发布副本纳入主站发布前检查。 |
| `scripts/deploy-vicdata.sh` | 在切换服务器站点前确认 VC 入口文件齐全。 |
| `.gitignore` | 忽略可重复生成的 `site/vc/`。 |

### Task 1: 生成并保护 `site/vc/` 发布副本

**Files:**

- Modify: `.gitignore`
- Modify: `scripts/build_victorian_century_site.mjs`
- Modify: `scripts/check_victorian_century_standalone_site.mjs`
- Create: `scripts/check_victorian_century_main_entry.mjs`

- [ ] **Step 1: 先写会失败的发布副本检查**

创建 `scripts/check_victorian_century_main_entry.mjs`，先写入以下检查。当前仓库没有 `site/vc/`，因此命令应因缺少发布副本而失败。

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const mainIndex = fs.readFileSync(path.join(root, "site", "index.html"), "utf8");
const versionsFile = path.join(root, "site", "versions.js");
const publishRoot = path.join(root, "site", "vc");
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(versionsFile, "utf8"), sandbox, { filename: versionsFile });
const libraries = sandbox.window.VIC3_VERSION_CONFIG?.libraries || [];

assert.deepEqual(libraries, [
  { id: "vic3", label: "Victoria 3 原版 1.13.9", href: "./" },
  { id: "victorian-century", label: "Victorian Century", href: "vc/" },
]);
assert.match(mainIndex, /id="vcHomeEntry"/, "main homepage must expose the VC entry");
assert.match(mainIndex, /href="vc\/"/, "main VC entry must use the relative vc path");
assert.match(mainIndex, /id="librarySelect"/, "main top bar must expose the library selector");
for (const file of ["index.html", "data-index.js", "map-data.js", "victorian-century-config.js", "assets/map/provinces.png"]) {
  assert.ok(fs.existsSync(path.join(publishRoot, file)), `missing published VC file: vc/${file}`);
}
console.log(JSON.stringify({ victorian_century_main_entry: "ok" }));
```

- [ ] **Step 2: 运行检查并确认失败原因正确**

运行：`node scripts/check_victorian_century_main_entry.mjs`

预期：命令以非零状态结束，首个失败信息指出 `libraries` 尚未定义或 `site/vc/` 缺少发布文件；不能因为语法错误或测试脚本自身错误失败。

- [ ] **Step 3: 为构建器增加显式发布目标**

在 `scripts/build_victorian_century_site.mjs` 将参数对象改为包含 `publishTarget`，并以以下分支解析 `--publish-target <dir>`：

```js
const parsed = { python: "", skipVcAssets: false, source: "", target: "", publishTarget: "" };

// 在 parseArgs() 的循环内替换原有 source/target 分支：
} else if (value === "--source" || value === "--target" || value === "--publish-target") {
  const key = value === "--publish-target" ? "publishTarget" : value.slice(2);
  parsed[key] = values[index + 1] || "";
  if (!parsed[key]) throw new Error(`Missing value for ${value}`);
  index += 1;
```

把帮助文本改为：

```js
console.log("Usage: node scripts/build_victorian_century_site.mjs [--source <dir>] [--target <dir>] [--publish-target <dir>] [--python <path>] [--skip-vc-assets]");
```

在现有 `writeStandaloneFiles(copied);` 后调用 `publishStandaloneSite(copied);`。新增函数必须只允许发布目录位于仓库根目录以内，并清空旧的生成目录后复制整个独立站：

```js
function publishStandaloneSite(copied) {
  if (!args.publishTarget) return;
  const relative = path.relative(root, args.publishTarget);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Publish target must stay inside the project: ${args.publishTarget}`);
  }
  fs.rmSync(args.publishTarget, { recursive: true, force: true });
  copyDirectory(targetSite, args.publishTarget, copied);
}
```

更新启动日志，增加 `publish_target: args.publishTarget ? toProjectPath(args.publishTarget) : ""`。将主站入口块包在 `<!-- MAIN_SITE_VC_ENTRY_START -->` 与 `<!-- MAIN_SITE_VC_ENTRY_END -->` 之间，并在 `buildStandaloneHtml()` 末尾删除该完整标记区间：

```js
.replace(/\s*<!-- MAIN_SITE_VC_ENTRY_START -->[\s\S]*?<!-- MAIN_SITE_VC_ENTRY_END -->/, "")
```

在 `.gitignore` 的生成站点区增加一行：

```gitignore
site/vc/
```

- [ ] **Step 4: 让更新流程产生发布副本**

在 `scripts/check_victorian_century_update.mjs` 的 `runUpdate()` 中，将构建器调用补上以下两个参数：

```js
"--publish-target", path.join(PROJECT_DIR, "site", "vc"),
```

参数必须紧跟在现有 `"--target", config.siteDir` 之后。这样模组更新和单独构建都会生成可发布副本，主站数据构建流程不读取 VC 数据。

- [ ] **Step 5: 扩展独立站静态检查并构建副本**

在 `scripts/check_victorian_century_standalone_site.mjs` 增加：

```js
const publishedRoot = path.join(root, "site", "vc");
for (const relative of ["index.html", "data-index.js", "map-data.js", "victorian-century-config.js", "assets/map/provinces.png"]) {
  assert(fs.existsSync(path.join(publishedRoot, relative)), `missing published VC file: site/vc/${relative}`);
  assert.equal(
    fs.readFileSync(path.join(publishedRoot, relative)).equals(fs.readFileSync(path.join(siteRoot, relative))),
    true,
    `published VC file differs from standalone build: ${relative}`,
  );
}
assert.doesNotMatch(fs.readFileSync(htmlFile, "utf8"), /id="vcHomeEntry"/, "standalone site must not link to itself");
```

运行：`node scripts/build_victorian_century_site.mjs --target "Victorian Century Database" --publish-target site/vc --skip-vc-assets; node scripts/check_victorian_century_standalone_site.mjs`

预期：两条命令均以状态 0 结束，第二条输出 `victorian_century_standalone_site: "ok"`。

- [ ] **Step 6: 提交生成与静态检查代码**

运行：

```powershell
git add .gitignore scripts/build_victorian_century_site.mjs scripts/check_victorian_century_update.mjs scripts/check_victorian_century_standalone_site.mjs scripts/check_victorian_century_main_entry.mjs
git commit -m "feat: publish Victorian Century under vc path"
```

预期：提交不包含 `site/vc/` 或 `Victorian Century Database/` 生成文件。

### Task 2: 首页入口与资料库选择器

**Files:**

- Modify: `site/versions.js`
- Modify: `site/index.html`
- Modify: `site/app/runtime.js`
- Modify: `site/app/data.js`
- Modify: `site/app/ui.js`
- Modify: `site/styles/home.css`
- Modify: `scripts/check_homepage_layout.mjs`
- Modify: `scripts/check_victorian_century_main_entry.mjs`

- [ ] **Step 1: 为页面合同写入失败检查**

在 `scripts/check_homepage_layout.mjs` 的首页顺序断言后加入：

```js
expect(indexSource.includes('id="vcHomeEntry"'), "homepage should include a Victorian Century entry");
expect(indexSource.includes('href="vc/"'), "homepage VC entry should use a relative vc path");
expect(
  indexSource.indexOf('id="homeWelcome"') < indexSource.indexOf('id="vcHomeEntry"')
    && indexSource.indexOf('id="vcHomeEntry"') < indexSource.indexOf('class="results"'),
  "homepage should place the VC entry after the site introduction and before category navigation",
);
expect(/\.home-mod-database-entry\s*\{[\s\S]*display:\s*grid/.test(stylesSource), "homepage should style the VC entry as an independent card");
```

在 `scripts/check_victorian_century_main_entry.mjs` 保留 Task 1 的资料库断言，使其在首页和选择器尚未实现时继续失败。

- [ ] **Step 2: 运行失败检查**

运行：`node scripts/check_homepage_layout.mjs; node scripts/check_victorian_century_main_entry.mjs`

预期：两条命令均以非零状态结束，错误分别指向 `vcHomeEntry` 和 `libraries`；原有首页断言不应出现新的失败。

- [ ] **Step 3: 以最小改动实现入口与选择器**

在 `site/versions.js` 的 `default_version` 后加入固定资料库清单：

```js
  libraries: [
    { id: "vic3", label: "Victoria 3 原版 1.13.9", href: "./" },
    { id: "victorian-century", label: "Victorian Century", href: "vc/" },
  ],
```

在 `site/index.html` 保留 `version-menu topbar-icon-select` 作为外观类，替换选择框为：

```html
<select id="librarySelect" aria-label="资料库切换"></select>
```

在 `homeWelcome` 中、`homeGuideButton` 后、版权说明前加入：

```html
<!-- MAIN_SITE_VC_ENTRY_START -->
<a id="vcHomeEntry" class="home-mod-database-entry" href="vc/" aria-label="进入 Victorian Century 资料库">
  <img class="lucide-icon" src="assets/lucide/icons/library-big.svg" alt="" aria-hidden="true">
  <span class="home-mod-database-copy"><strong>Victorian Century 资料库</strong><small>模组数据与地图</small></span>
  <span class="home-guide-arrow" aria-hidden="true">→</span>
</a>
<!-- MAIN_SITE_VC_ENTRY_END -->
```

在 `site/app/runtime.js` 的元素表中把 `versionSelect` 改为：

```js
librarySelect: document.querySelector("#librarySelect"),
```

在 `site/app/data.js` 用下列函数替换 `renderVersionOptions()`，并将 `applyLoadedDataset()` 中的调用改为 `renderLibraryOptions()`；删除 `loadVersion()` 中对选择框赋值的行：

```js
function renderLibraryOptions() {
  if (!els.librarySelect || !versionConfig) return;
  const entries = Array.isArray(versionConfig.libraries) ? versionConfig.libraries : [];
  els.librarySelect.innerHTML = entries.map((entry) => (
    `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.label)}</option>`
  )).join("");
  els.librarySelect.value = "vic3";
}

function libraryEntry(id) {
  return (versionConfig?.libraries || []).find((entry) => entry.id === id) || null;
}
```

在 `site/app/ui.js` 用下列监听器替换旧的 `versionSelect` 监听器。`vic3` 不加载或刷新数据；VC 选项使用 `location.assign()` 进入独立站。

```js
els.librarySelect?.addEventListener("change", () => {
  const entry = libraryEntry(els.librarySelect.value);
  if (!entry || entry.id === "vic3") {
    els.librarySelect.value = "vic3";
    return;
  }
  const target = new URL(entry.href, window.location.href);
  location.assign(target.href);
});
```

在 `site/styles/home.css` 添加：

```css
.home-mod-database-entry {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-top: 12px;
  padding: 13px 14px;
  border: 1px solid rgba(200, 164, 91, 0.28);
  border-radius: 8px;
  background: var(--panel-glass-strong);
  color: var(--ink);
  text-decoration: none;
}

.home-mod-database-entry:hover {
  border-color: rgba(200, 164, 91, 0.5);
  background: var(--accent-blue);
}

.home-mod-database-copy {
  display: grid;
  gap: 2px;
}

.home-mod-database-copy strong {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
}

.home-mod-database-copy small {
  color: var(--muted);
  font-size: var(--text-xs);
}
```

- [ ] **Step 4: 运行静态检查并检查语法**

运行：

```powershell
node scripts/build_victorian_century_site.mjs --target "Victorian Century Database" --publish-target site/vc --skip-vc-assets
node scripts/check_homepage_layout.mjs
node scripts/check_victorian_century_main_entry.mjs
node --check site/app/runtime.js
node --check site/app/data.js
node --check site/app/ui.js
git diff --check
```

预期：所有命令以状态 0 结束；资料库选择器只含两个选项，首页入口位于说明与分类之间，静态入口指向 `vc/`。

- [ ] **Step 5: 提交主站界面改动**

运行：

```powershell
git add site/versions.js site/index.html site/app/runtime.js site/app/data.js site/app/ui.js site/styles/home.css scripts/check_homepage_layout.mjs scripts/check_victorian_century_main_entry.mjs
git commit -m "feat: add Victorian Century main site entry"
```

预期：提交包含主站界面、资料库配置和对应静态检查，不包含生成站点内容。

### Task 3: 把 VC 副本纳入发布前检查与服务器切换

**Files:**

- Modify: `scripts/check_publish_bundle.mjs`
- Modify: `scripts/check_deploy_vicdata_script.mjs`
- Modify: `scripts/deploy-vicdata.sh`

- [ ] **Step 1: 为发布包写入失败断言**

在 `scripts/check_deploy_vicdata_script.mjs` 的版本数据断言后加入：

```js
assert.match(source, /test -f "\$STAGE\/vc\/index\.html"/, "deployment script must verify the VC entry page");
assert.match(source, /test -f "\$STAGE\/vc\/data-index\.js"/, "deployment script must verify the VC data index");
assert.match(source, /test -f "\$STAGE\/vc\/map-data\.js"/, "deployment script must verify the VC map index");
```

在 `scripts/check_publish_bundle.mjs` 初始化 `requiredFiles` 后加入：

```js
for (const relative of ["vc/index.html", "vc/data-index.js", "vc/map-data.js", "vc/victorian-century-config.js", "vc/assets/map/provinces.png"]) {
  requiredFiles.add(relative);
}
```

- [ ] **Step 2: 运行失败检查**

运行：`node scripts/check_deploy_vicdata_script.mjs; node scripts/check_publish_bundle.mjs`

预期：第一个命令因部署脚本尚未验证 VC 文件失败；第二个命令会在 `site/vc/` 未生成时报告缺少发布文件。不能跳过这两个失败结果。

- [ ] **Step 3: 实现部署保护**

在 `scripts/deploy-vicdata.sh` 现有两条主站文件检查后加入：

```sh
test -f "$STAGE/vc/index.html"
test -f "$STAGE/vc/data-index.js"
test -f "$STAGE/vc/map-data.js"
test -f "$STAGE/vc/victorian-century-config.js"
test -f "$STAGE/vc/assets/map/provinces.png"
```

`check_publish_bundle.mjs` 保留 Step 1 的必需文件清单。发布检查只验证本地生成的 `site/vc/`，不读取 `Victorian Century Database/`，确保发布包是唯一的服务器输入。

- [ ] **Step 4: 运行发布检查**

运行：

```powershell
node scripts/check_deploy_vicdata_script.mjs
node scripts/check_publish_bundle.mjs
sh -n scripts/deploy-vicdata.sh
git diff --check
```

预期：全部以状态 0 结束；发布包检查输出 `publish_bundle: "ok"`，部署脚本仍保持只做内容校验和目录切换。

- [ ] **Step 5: 提交发布检查改动**

运行：

```powershell
git add scripts/check_publish_bundle.mjs scripts/check_deploy_vicdata_script.mjs scripts/deploy-vicdata.sh
git commit -m "test: require Victorian Century release files"
```

预期：提交只包含发布包合同和部署切换前的文件校验。

### Task 4: 浏览器验证、增量发布与公网核验

**Files:**

- Create: `scripts/check_victorian_century_main_entry_browser.mjs`
- Modify: `scripts/check_victorian_century_browser.mjs`

- [ ] **Step 1: 写入会失败的浏览器交互检查**

创建 `scripts/check_victorian_century_main_entry_browser.mjs`。脚本以第一个参数为主站根地址，启动 Playwright 后打开 `#/home`，等待 `#vcHomeEntry` 和 `#librarySelect`，检查入口 `href` 等于 `vc/`，并选择 `victorian-century` 后等待 URL 变为 `/vc/`。核心交互代码如下：

```js
await page.goto(`${baseUrl}#/home`, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForSelector("#vcHomeEntry", { timeout: 20000 });
assert.equal(await page.locator("#vcHomeEntry").getAttribute("href"), "vc/");
await Promise.all([
  page.waitForURL(/\/vc\/$/, { timeout: 20000 }),
  page.locator("#vcHomeEntry").click(),
]);
assert.equal(await page.title(), "首页 - Victorian Century Database");
await page.goto(`${baseUrl}#/home`, { waitUntil: "networkidle", timeout: 45000 });
assert.deepEqual(await page.locator("#librarySelect option").evaluateAll((options) => (
  options.map((option) => ({ value: option.value, text: option.textContent.trim() }))
)), [
  { value: "vic3", text: "Victoria 3 原版 1.13.9" },
  { value: "victorian-century", text: "Victorian Century" },
]);
await Promise.all([
  page.waitForURL(/\/vc\/$/, { timeout: 20000 }),
  page.selectOption("#librarySelect", "victorian-century"),
]);
await page.waitForSelector("#countryList .home-category-card", { timeout: 20000 });
assert.equal(await page.title(), "首页 - Victorian Century Database");
```

脚本必须收集 `console` 错误和 `pageerror`，在退出前抛出所有错误。当前实现缺少两个选择器，因此运行应失败。

- [ ] **Step 2: 运行失败检查**

先以隐藏窗口启动本地静态服务器：

```powershell
$server = Start-Process -FilePath node -ArgumentList 'scripts/serve_site.mjs','site','4173' -WorkingDirectory 'D:\Bot\Vic3\Victoria3_DB' -WindowStyle Hidden -PassThru
try { node scripts/check_victorian_century_main_entry_browser.mjs http://127.0.0.1:4173/ } finally { Stop-Process -Id $server.Id -Force }
```

预期：命令因等待 `#vcHomeEntry` 或 `#librarySelect` 超时失败。

- [ ] **Step 3: 扩展独立站浏览器合同**

在 `scripts/check_victorian_century_browser.mjs` 的首页采样对象中将 `versionSelector` 改为 `librarySelector: Boolean(document.querySelector("#librarySelect"))`，并将首页断言改为：

```js
assert(!home.librarySelector && !home.announcements && !home.news && !home.changelog, "standalone home includes an excluded feature");
```

这会保证构建器删除主站资料库选择器和主页 VC 自链接。

- [ ] **Step 4: 运行本地浏览器与全量静态验证**

运行：

```powershell
$server = Start-Process -FilePath node -ArgumentList 'scripts/serve_site.mjs','site','4173' -WorkingDirectory 'D:\Bot\Vic3\Victoria3_DB' -WindowStyle Hidden -PassThru
try {
  node scripts/check_victorian_century_main_entry_browser.mjs http://127.0.0.1:4173/
  node scripts/check_victorian_century_browser.mjs http://127.0.0.1:4173/vc/
} finally {
  Stop-Process -Id $server.Id -Force
}
node scripts/check_homepage_layout.mjs
node scripts/check_victorian_century_main_entry.mjs
node scripts/check_victorian_century_standalone_site.mjs
node scripts/check_publish_bundle.mjs
node scripts/check_deploy_vicdata_script.mjs
git diff --check
```

预期：两个浏览器脚本和全部静态检查都以状态 0 结束；主站首页可见 VC 卡片，资料库选择器跳转到本地 `/vc/`，独立站不显示选择器或自链接。

- [ ] **Step 5: 提交浏览器回归检查**

运行：

```powershell
git add scripts/check_victorian_century_main_entry_browser.mjs scripts/check_victorian_century_browser.mjs
git commit -m "test: cover Victorian Century entry navigation"
```

预期：提交只包含浏览器回归检查的新增与调整。

- [ ] **Step 6: 通过增量暂存目录发布**

运行以下 PowerShell。命令先创建唯一的远端暂存目录，再以当前线上站点为 `--link-dest` 进行预演和真实同步；不覆盖活动目录。

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$stage = "/home/vicadmin/vicdata-stage-$stamp-vc"
$ssh = 'ssh -i C:/Users/SamuY/.ssh/id_ed25519 -o IdentitiesOnly=yes -o UserKnownHostsFile=C:/Users/SamuY/.ssh/known_hosts'
$env:RSYNC_RSH = $ssh
ssh.exe -i 'C:\Users\SamuY\.ssh\id_ed25519' -o IdentitiesOnly=yes vicadmin@103.214.174.247 "test ! -e '$stage' && mkdir '$stage'"
& 'C:\msys64\usr\bin\rsync.exe' -az --delete --link-dest=/var/www/vicdata/site --dry-run --itemize-changes --exclude='debug-*' --exclude='*.log' 'site/' "vicadmin@103.214.174.247:$stage/"
& 'C:\msys64\usr\bin\rsync.exe' -az --delete --link-dest=/var/www/vicdata/site --exclude='debug-*' --exclude='*.log' 'site/' "vicadmin@103.214.174.247:$stage/"
ssh.exe -i 'C:\Users\SamuY\.ssh\id_ed25519' -o IdentitiesOnly=yes vicadmin@103.214.174.247 "test -f '$stage/index.html' && test -f '$stage/vc/index.html' && test -f '$stage/vc/data-index.js' && test -f '$stage/vc/map-data.js'"
scp.exe -i 'C:\Users\SamuY\.ssh\id_ed25519' -o IdentitiesOnly=yes 'scripts/deploy-vicdata.sh' 'vicadmin@103.214.174.247:/home/vicadmin/deploy-vicdata.sh'
ssh.exe -i 'C:\Users\SamuY\.ssh\id_ed25519' -o IdentitiesOnly=yes vicadmin@103.214.174.247 "chmod 700 /home/vicadmin/deploy-vicdata.sh && sh /home/vicadmin/deploy-vicdata.sh '$stage'"
```

预期：预演仅列出新增或变化文件；真实同步完成后部署脚本输出 `vicdata deploy complete`，旧站保留为带时间戳的回退目录。

- [ ] **Step 7: 串行完成公网核验**

运行：

```powershell
curl.exe -sSIL --max-time 20 https://vic3database.org/vc/
curl.exe -sSIL --max-time 20 https://vic3database.org/vc/data-index.js
node scripts/check_victorian_century_main_entry_browser.mjs https://vic3database.org/
node scripts/check_victorian_century_browser.mjs https://vic3database.org/vc/
```

预期：两个 HTTP 请求返回 `200 OK`；浏览器检查通过，正式首页入口和选择器到 `https://vic3database.org/vc/` 的路径无控制台错误。
