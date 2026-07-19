# Vicdata 加载遮罩实施计划

> **供代理执行：** 实施时调用 superpowers:executing-plans，按任务顺序完成、检查并提交。

**目标：** 为首次打开、版本切换、路由或详情数据读取、更新日志和全局搜索提供可取消的深色加载遮罩；快速的同步筛选不显示遮罩。

**结构：** 新增独立加载控制器，集中处理 150 毫秒阈值、操作代号、取消信号、焦点和底层页面锁定。数据读取函数接收操作对象，并仅让仍有效的操作提交新数据。网站现有的全局脚本加载顺序保持不变。

**技术：** 原生 HTML、CSS、浏览器原生 JavaScript、Node 静态检查。

---

## 文件职责

| 文件 | 修改内容 |
| --- | --- |
| site/index.html | 加入遮罩语义结构，并登记加载控制脚本。 |
| site/styles/loading.css | 深色遮罩、圆形图标、进度、取消按钮、动画和窄屏布局。 |
| site/styles.css | 导入新增样式。 |
| site/app/runtime.js | 保存遮罩节点和加载状态。 |
| site/app/loading.js | 处理延迟、取消、最新操作优先、焦点和页面锁定。 |
| site/app/data.js | 让版本与分块读取可取消且只提交有效结果。 |
| site/app/ui.js、site/app/boards.js | 在异步入口调用加载控制器。 |
| scripts/site_frontend_sources.mjs、scripts/check_frontend_file_split.mjs | 登记新的前端分区。 |
| scripts/check_loading_overlay.mjs | 静态检查页面结构、视觉、取消和异步入口。 |

## 任务 1：建立会失败的加载遮罩契约

**文件：**

- 创建：scripts/check_loading_overlay.mjs

- [ ] **步骤 1：创建静态检查。**

~~~~js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readSiteAppSource, readSiteStyleSource } from "./site_frontend_sources.mjs";

const root = process.cwd();
const index = fs.readFileSync(path.join(root, "site", "index.html"), "utf8");
const app = readSiteAppSource(root);
const styles = readSiteStyleSource(root);

assert.match(index, /id="loadingOverlay"/, "页面应包含加载遮罩");
assert.match(index, /id="loadingCancelButton"/, "遮罩应包含取消按钮");
assert.match(index, /id="loadingProgress"/, "遮罩应包含进度条");
assert.match(index, /assets\/brand\/vicdata-icon-192\.png/, "遮罩应复用站点图标");
assert.match(app, /const LOAD_OVERLAY_DELAY_MS = 150/, "显示阈值应为 150 毫秒");
assert.match(app, /function runWithLoading\(/, "异步入口应调用统一加载控制器");
assert.match(app, /new AbortController\(\)/, "每项加载应有取消控制器");
assert.match(app, /function loadScriptValue\(src, globalName, options = \{\}\)/, "脚本读取应接收操作选项");
assert.match(styles, /\.loading-overlay\s*\{[\s\S]*position:\s*fixed/, "遮罩应固定覆盖页面");
assert.match(styles, /rgba\(10,\s*14,\s*16,\s*0\.72\)/, "遮罩应采用确认过的深色透明度");
assert.match(styles, /\.loading-progress-row/, "进度条与取消按钮应处于同一行");

console.log(JSON.stringify({ loading_overlay: "ok" }, null, 2));
~~~~

- [ ] **步骤 2：运行检查，确认它失败。**

运行：node scripts/check_loading_overlay.mjs

预期：失败，并报告 loadingOverlay 尚不存在。

- [ ] **步骤 3：提交检查基线。**

~~~~powershell
git add scripts/check_loading_overlay.mjs
git commit -m "test: add loading overlay contract"
~~~~

## 任务 2：添加遮罩结构、深色视觉与分区登记

**文件：**

- 修改：site/index.html
- 修改：site/styles.css
- 创建：site/styles/loading.css
- 修改：scripts/site_frontend_sources.mjs
- 修改：scripts/check_frontend_file_split.mjs

- [ ] **步骤 1：在 index.html 的主内容后、页面脚本前加入遮罩。**

~~~~html
<div id="loadingOverlay" class="loading-overlay" hidden aria-hidden="true">
  <section class="loading-card" role="status" aria-live="polite" aria-labelledby="loadingTitle">
    <div class="loading-seal">
      <img src="assets/brand/vicdata-icon-192.png" alt="" aria-hidden="true">
    </div>
    <h2 id="loadingTitle">正在整理资料</h2>
    <p id="loadingMessage">正在准备资料库。</p>
    <div class="loading-progress-row">
      <div id="loadingProgress" class="loading-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuetext="载入中">
        <span id="loadingProgressFill" class="loading-progress-fill"></span>
      </div>
      <button id="loadingCancelButton" type="button" aria-label="取消当前加载">取消</button>
    </div>
    <div class="loading-progress-meta"><span id="loadingStage">准备中</span><span id="loadingPercent">载入中</span></div>
  </section>
</div>
~~~~

在 app/runtime.js 后、app/data.js 前加入：

~~~~html
<script src="app/loading.js?v=20260719-loading-overlay1"></script>
~~~~

- [ ] **步骤 2：创建 loading.css 并在 styles.css 导入。**

~~~~css
.loading-overlay {
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(10, 14, 16, 0.72);
  backdrop-filter: blur(1px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 160ms ease;
}

.loading-overlay.is-visible {
  opacity: 1;
  pointer-events: auto;
}

.loading-overlay[hidden] {
  display: none !important;
}

.loading-card {
  width: min(420px, 100%);
  text-align: center;
}

.loading-progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.loading-progress {
  flex: 1;
  height: 4px;
  overflow: hidden;
  background: rgba(238, 232, 221, 0.2);
}

.loading-progress-fill {
  display: block;
  width: 48%;
  height: 100%;
  background: linear-gradient(90deg, var(--accent), #87bdba);
}

.loading-progress.is-indeterminate .loading-progress-fill {
  width: 36%;
  animation: loading-progress 1.05s ease-in-out infinite alternate;
}

@keyframes loading-progress {
  from { transform: translateX(-110%); }
  to { transform: translateX(285%); }
}

@media (max-width: 760px) {
  .loading-card { width: min(340px, 100%); }
}
~~~~

补充 loading-seal、loading-seal img、loadingCancelButton 和 loading-progress-meta。印记使用深蓝灰底色与金色边框；取消按钮保持低亮度描边；它不得绝对定位，必须一直位于进度条右侧。

- [ ] **步骤 3：登记两个新增分区。**

在 scripts/site_frontend_sources.mjs 的 appSections 中将 app/loading.js 放在 app/runtime.js 后，在 styleSections 末尾加入 styles/loading.css。在 scripts/check_frontend_file_split.mjs 的两个数组作同样修改。

- [ ] **步骤 4：运行检查。**

运行：node scripts/check_loading_overlay.mjs; node scripts/check_frontend_file_split.mjs

预期：结构和样式断言通过，控制器和数据读取断言仍失败。

- [ ] **步骤 5：提交本任务。**

~~~~powershell
git add site/index.html site/styles.css site/styles/loading.css scripts/site_frontend_sources.mjs scripts/check_frontend_file_split.mjs
git commit -m "feat: add loading overlay shell"
~~~~

## 任务 3：实现可取消的加载控制器

**文件：**

- 修改：site/app/runtime.js
- 创建：site/app/loading.js
- 修改：scripts/check_loading_overlay.mjs

- [ ] **步骤 1：扩展静态检查。**

~~~~js
assert.match(app, /function isCurrentLoadingOperation\(operation\)/, "迟到响应必须能够识别为过期操作");
assert.match(app, /previous\?\.controller\.abort\(\)/, "新操作应取消旧操作");
assert.match(app, /loadingCancelButton\?\.addEventListener\("click", cancelActiveLoading\)/, "取消按钮应连接加载控制器");
assert.match(app, /node\.inert = visible/, "遮罩出现时应锁定底层页面");
assert.match(app, /loadingCancelButton\?\.focus\(\)/, "焦点应进入取消按钮");
assert.match(app, /previousFocus\?\.focus\(\)/, "遮罩关闭后应恢复原焦点");
~~~~

运行：node scripts/check_loading_overlay.mjs

预期：失败，提示加载控制器尚不存在。

- [ ] **步骤 2：在 runtime.js 的 els 对象添加节点，并声明加载状态。**

~~~~js
  loadingOverlay: document.querySelector("#loadingOverlay"),
  loadingTitle: document.querySelector("#loadingTitle"),
  loadingMessage: document.querySelector("#loadingMessage"),
  loadingProgress: document.querySelector("#loadingProgress"),
  loadingProgressFill: document.querySelector("#loadingProgressFill"),
  loadingStage: document.querySelector("#loadingStage"),
  loadingPercent: document.querySelector("#loadingPercent"),
  loadingCancelButton: document.querySelector("#loadingCancelButton"),
~~~~

~~~~js
const LOAD_OVERLAY_DELAY_MS = 150;
let activeLoadingOperation = null;
let loadingOperationSequence = 0;
~~~~

- [ ] **步骤 3：在 loading.js 实现操作接口。**

~~~~js
function isCurrentLoadingOperation(operation) {
  return activeLoadingOperation?.id === operation.id && !operation.controller.signal.aborted;
}

function createLoadingCancelledError() {
  const error = new DOMException("加载已取消", "AbortError");
  error.loadingCancelled = true;
  return error;
}

function throwIfLoadingCancelled(operation) {
  if (!operation || !isCurrentLoadingOperation(operation)) throw createLoadingCancelledError();
}
~~~~

runWithLoading(options, work) 的次序固定为：取消旧操作；记录焦点；新建递增 id 和 AbortController；设置 150 毫秒计时器；计时器触发后显示遮罩；执行 work(operation)；仅当前操作返回成功结果；最后清理操作。它返回 { cancelled, value }，取消或被新操作替代时返回 { cancelled: true, value: undefined }，其他错误继续抛回入口。

showLoadingOverlay 写入标题、文案、阶段与可选百分比。progress 为 null 时加入 is-indeterminate，并显示“载入中”。显示时先移除 hidden，在下一帧添加 is-visible；对 body > header 和 body > main 分别执行：

~~~~js
node.inert = visible;
node.setAttribute("aria-busy", String(visible));
~~~~

显示后执行：

~~~~js
els.loadingCancelButton?.focus();
~~~~

cancelActiveLoading 调用当前控制器 abort()，把按钮改成“已取消”并禁用重复点击。finishLoadingOperation 只有在操作仍是当前操作时才淡出遮罩、恢复 hidden、解除 inert 和 aria-busy，并恢复先前焦点：

~~~~js
operation.previousFocus?.focus();
~~~~

文件末尾绑定：

~~~~js
els.loadingCancelButton?.addEventListener("click", cancelActiveLoading);
~~~~

- [ ] **步骤 4：运行检查。**

运行：node scripts/check_loading_overlay.mjs; node --check site/app/loading.js

预期：遮罩、取消、焦点和锁定检查通过；数据读取选项断言仍失败。

- [ ] **步骤 5：提交本任务。**

~~~~powershell
git add site/app/runtime.js site/app/loading.js scripts/check_loading_overlay.mjs
git commit -m "feat: add cancellable loading controller"
~~~~

## 任务 4：让版本与分块数据只提交有效结果

**文件：**

- 修改：site/app/data.js
- 修改：scripts/check_loading_overlay.mjs

- [ ] **步骤 1：扩展失败检查。**

~~~~js
assert.match(app, /options\.signal\?\.addEventListener\("abort"/, "取消应移除未完成的脚本标签");
assert.match(app, /throwIfLoadingCancelled\(options\.operation\)/, "异步返回后应检查操作是否仍有效");
assert.match(app, /const nextData = \{ \.\.\.data \}/, "分块读取应先在副本中累积数据");
assert.match(app, /applyLoadedDataset\(nextData, nextMapData\)/, "版本数据完成后才应一次提交");
assert.match(app, /dataChunkLoadPromise = null/, "数据分块锁应在完成或取消后释放");
~~~~

运行：node scripts/check_loading_overlay.mjs

预期：失败，提示脚本读取未接收中止信号。

- [ ] **步骤 2：为 loadScriptValue 增加可取消参数。**

签名改为：

~~~~js
function loadScriptValue(src, globalName, options = {}) {
~~~~

函数开始时检查 options.signal?.aborted 并拒绝 createLoadingCancelledError()。脚本标签插入后注册一次性 abort 监听器，监听器删除脚本并拒绝同一错误。onload 和 onerror 均移除该监听器；onload 在读取全局变量前后都检查信号。这样取消时移除尚未执行的动态脚本，已经返回的旧结果仍由操作代号阻止提交。

- [ ] **步骤 3：向数据函数传递 operation，并将数据提交延后。**

loadVersion、ensureDataChunksForRoute 和 ensureDataChunks 接收 options = {}。每个 await 后执行：

~~~~js
throwIfLoadingCancelled(options.operation);
~~~~

loadVersion 使用局部变量保存索引、地图、版本、nextData 与 nextLoadedChunks；索引、地图和当前路由的所需分块完成后，且操作仍有效时，才更新 dataIndex、loadedDataVersion、loadedDataChunks、版本选择框、网址和 applyLoadedDataset(nextData, nextMapData)。

ensureDataChunks 从副本开始：

~~~~js
const nextData = { ...data };
const nextLoadedChunks = new Set(loadedDataChunks);
~~~~

循环只写入副本。成功后才 applyLoadedDataset(nextData, mapData)，再把 nextLoadedChunks 写回集合。取消、失败和过期操作均不得改变版本、地图缓存、网址或已显示列表。

- [ ] **步骤 4：运行数据检查。**

运行：node scripts/check_loading_overlay.mjs; node scripts/check_data_chunking.mjs; node --check site/app/data.js

预期：全部通过。

- [ ] **步骤 5：提交本任务。**

~~~~powershell
git add site/app/data.js scripts/check_loading_overlay.mjs
git commit -m "fix: keep cancelled data loads from committing"
~~~~

## 任务 5：接入所有入口并完成验证

**文件：**

- 修改：site/app/data.js
- 修改：site/app/ui.js
- 修改：site/app/boards.js
- 修改：scripts/check_loading_overlay.mjs
- 必要时修改：site/app/loading.js、site/styles/loading.css

- [ ] **步骤 1：为入口加入失败断言。**

~~~~js
assert.match(app, /正在整理资料/, "首次打开应有完整加载文案");
assert.match(app, /正在切换版本/, "版本切换应显示对应文案");
assert.match(app, /正在载入.*资料/, "路由和详情的分块读取应显示板块文案");
assert.match(app, /正在准备全局搜索/, "全局搜索补齐分块时应显示文案");
assert.match(app, /正在加载更新日志/, "更新日志读取应显示文案");
assert.match(app, /result\.cancelled\) return/, "取消后不得继续渲染旧操作");
~~~~

运行：node scripts/check_loading_overlay.mjs

预期：失败，缺少入口调用。

- [ ] **步骤 2：包装异步入口。**

init() 使用“正在整理资料”和“正在读取国家、地区与地图数据”。版本选择事件使用“正在切换版本”。setView()、hashchange 和详情路由按 routeView() 使用“正在载入国家资料”“正在载入地区资料”等文案。openGlobalSearchDialog() 在补齐分块时使用“正在准备全局搜索”。loadChangelogPair() 使用“正在加载更新日志”。

每个入口使用同一形状：

~~~~js
const result = await runWithLoading(options, async (operation) => {
  await loadVersion(version, { operation });
  await applyHash({ operation });
});
if (result.cancelled) return;
render();
~~~~

applyHash 也接收 options = {}，并把它传给 ensureDataChunksForRoute。首次读取和版本切换在索引、地图和分块之间调用 updateLoadingOperation(operation, details) 更新确定进度。路由、全局搜索和更新日志没有可靠进度时使用不确定进度，不能显示伪造百分比。

同步筛选、搜索输入、排序和地图显示选项经 runWithLoading 建立操作边界，但直接在下一帧完成 render()。常规本地重绘会在 150 毫秒内结束，遮罩不会出现；将来改为异步读取时可沿用同一控制器。

- [ ] **步骤 3：保留旧页面直到新数据提交。**

更新日志成功前不得清空 changelogData、changelogLoadedPair、当前筛选或列表。全局搜索的数据未齐时不得显示空白对话框。版本与路由操作取消后，网址、选择框、已打开详情和地图内容均不改变。

- [ ] **步骤 4：运行完整静态回归。**

~~~~powershell
node scripts/check_loading_overlay.mjs
node scripts/check_data_chunking.mjs
node scripts/check_frontend_file_split.mjs
node scripts/check_global_search.mjs
node scripts/check_about_page.mjs
node scripts/check_right_panel_layout.mjs
node scripts/check_site_asset_coverage.mjs
node --check site/app/loading.js
node --check site/app/data.js
node --check site/app/ui.js
node --check site/app/boards.js
git diff --check
~~~~

预期：全部通过。已有无关检查失败要单独记录，不能归入加载遮罩回归。

- [ ] **步骤 5：低频浏览器验证。**

网络节流为“快速 3G”，依次验证首次打开、版本切换、进入尚未加载的国家或地区详情、全局搜索和更新日志。确认深遮罩仍可看到页面轮廓，中心图标与文案可读，取消按钮位于进度条右侧，底层控件不可点击。点击取消后检查路由、版本和资料不变；立刻开始新操作，确认旧响应不会覆盖新页面。将窗口缩至 760 像素以下，确认文案、进度和取消按钮不重叠。

- [ ] **步骤 6：提交本任务。**

~~~~powershell
git add site/app/data.js site/app/ui.js site/app/boards.js site/app/loading.js site/styles/loading.css scripts/check_loading_overlay.mjs
git commit -m "feat: show loading overlay for async navigation"
~~~~

